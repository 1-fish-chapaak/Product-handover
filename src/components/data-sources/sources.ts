// Shared seed + types for data sources. Consumed by DataSourcesView (browse)
// and DataPickerModal (chat-attach). Single source of truth for the mock list.

import {
  Database, FileText, MessageSquare,
} from 'lucide-react';

export type SourceType = 'file' | 'database' | 'session';

export interface DataSource {
  id: string;
  name: string;
  type: SourceType;
  /** Sub-detail shown under the name (file format, db engine, linked chat, etc.) */
  subtype: string;
  createdAt: string; // ISO date
  /** Optional override for the date shown on the card. When set, the card
   *  renders this date instead of `createdAt` — useful for folders whose
   *  "last modified" / "indexed at" reads differently from when they were
   *  added to the catalog. Bucketing + sort still use `createdAt`. */
  displayDate?: string; // ISO date
  /** Available columns this source exposes. For databases the full schema
   *  lives in DB_SCHEMAS keyed by id; this flat list is the file equivalent
   *  (and the fallback surface for non-DB sources). */
  columns?: string[];
  /** True for folder-aggregate sources (one card per uploaded folder). */
  isFolder?: boolean;
  /** Optional explicit health for integrations. When set, overrides the
   *  hash-based fallback so seeded data can force a "Needs reconnection"
   *  card for demos. Ignored for non-integration source types. */
  health?: 'healthy' | 'degraded';
}

// The app's reference "now". Anchored to the real current date (UTC midnight,
// matching the date-only semantics the seed offsets + date filter rely on) so
// "Today" actually means today and all relative upload dates stay current.
export const TODAY = new Date(new Date().toISOString().slice(0, 10));

const dayOffset = (n: number): string => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export const SEED: DataSource[] = [
  // ── Folder uploads (one card per uploaded folder) ──
  { id: 'fd-01', name: 'Q1 SOX evidence',          type: 'file', isFolder: true, subtype: 'Folder · 12 files · 84.2 MB',  createdAt: dayOffset(1) },
  { id: 'fd-02', name: 'Vendor master extracts',   type: 'file', isFolder: true, subtype: 'Folder · 8 files · 31.6 MB',   createdAt: dayOffset(4) },
  { id: 'fd-03', name: 'FY26 board pack',          type: 'file', isFolder: true, subtype: 'Folder · 21 files · 142.0 MB', createdAt: dayOffset(7) },

  // ── Files (manual uploads — one file per card) ──
  { id: 'f-03', name: 'Emaar Extraction',                      type: 'file', subtype: 'CSV · 4.8 MB',   createdAt: dayOffset(3),
    columns: ['Vendor', 'Invoice ID', 'Invoice Date', 'Amount', 'Status', 'Description'] },
  { id: 'f-06', name: 'Import Remittance — Bank Demo',         type: 'file', subtype: 'CSV · 1.4 MB',   createdAt: dayOffset(3) },
  { id: 'f-08', name: 'Demo Invoice Data 1604',                type: 'file', subtype: 'CSV · 3.3 MB',   createdAt: dayOffset(7) },
  { id: 'f-11', name: 'Airline Group HR KPI — Dummy Employees',    type: 'file', subtype: 'CSV · 2.9 MB',   createdAt: dayOffset(8) },
  { id: 'f-12', name: 'NSE Agreement Sample',                  type: 'file', subtype: 'PDF · 4.4 MB',   createdAt: dayOffset(9) },
  { id: 'f-14', name: 'NSE Position Limits Monitoring',        type: 'file', subtype: 'CSV · 1.8 MB',   createdAt: dayOffset(11) },
  { id: 'f-15', name: 'NSE Penalty on Shortfall Margin',       type: 'file', subtype: 'XLSX · 3.5 MB',  createdAt: dayOffset(11) },
  { id: 'f-16', name: 'Airline Group HR KPI — Bills vs Reimbursement', type: 'file', subtype: 'XLSX · 6.0 MB', createdAt: dayOffset(13) },

  // ── Multi-file uploads (folder aggregates — one folder per card) ──
  { id: 'f-01', name: 'AI_Fare Audit',           type: 'file', isFolder: true, subtype: 'Folder · 2 files · 12.4 MB', createdAt: dayOffset(0),
    columns: ['Date', 'Region', 'Route', 'Airline', 'Fare Type', 'Amount', 'Variance'] },
  { id: 'f-02', name: 'PwC Status',              type: 'file', isFolder: true, subtype: 'Folder · 2 files · 2.1 MB',  createdAt: dayOffset(0) },
  { id: 'f-04', name: 'Emaar Payment Extraction', type: 'file', isFolder: true, subtype: 'Folder · 2 files · 6.2 MB', createdAt: dayOffset(3) },
  { id: 'f-05', name: 'Loan Details Extraction', type: 'file', isFolder: true, subtype: 'Folder · 3 files · 8.7 MB',  createdAt: dayOffset(3),
    columns: ['Loan ID', 'Borrower', 'Principal', 'Interest Rate', 'Term Months', 'Status'] },
  { id: 'f-07', name: 'Media Demo',              type: 'file', isFolder: true, subtype: 'Folder · 2 files · 9.1 MB',  createdAt: dayOffset(6) },
  { id: 'f-09', name: 'Demo Agreements',         type: 'file', isFolder: true, subtype: 'Folder · 3 files · 1.9 MB',  createdAt: dayOffset(7) },
  { id: 'f-10', name: 'MB5B Demo',               type: 'file', isFolder: true, subtype: 'Folder · 2 files · 5.7 MB',  createdAt: dayOffset(7) },
  { id: 'f-13', name: 'NSE AP Analytics',        type: 'file', isFolder: true, subtype: 'Folder · 2 files · 7.6 MB',  createdAt: dayOffset(9) },
  // Long-column fixture — used to exercise the column-picker's scroll,
  // sticky section headings, and search at scale (60+ columns).
  { id: 'f-17', name: 'Amex Settlement Statement', type: 'file', subtype: 'CSV · 24.6 MB', createdAt: dayOffset(1),
    columns: [
      'Current Date', 'Payment Date', 'Settlement number', 'Submission / Transaction Reference Number',
      'Record Type', 'Submitting Merchant ID', 'Submission SE Name', 'Terminal ID', 'Batch Number',
      'Submission SE Branch No', 'Transaction Timestamp', 'Authorisation Code', 'Authorisation Date',
      'Card Number (Masked)', 'Card Product', 'Card Type', 'Issuer Country', 'Issuer Bank',
      'Transaction Amount', 'Transaction Currency', 'Settlement Amount', 'Settlement Currency',
      'Exchange Rate', 'Interchange Fee', 'Assessment Fee', 'Processing Fee', 'Net Amount',
      'MCC', 'Merchant Name (DBA)', 'Merchant Legal Name', 'Merchant Tax ID', 'Merchant Address Line 1',
      'Merchant Address Line 2', 'Merchant City', 'Merchant State', 'Merchant Postal Code',
      'Merchant Country', 'Merchant Phone', 'Merchant Email', 'Acquiring Bank', 'Acquiring BIN',
      'Acquiring Reference Number', 'Capture Method', 'POS Entry Mode', 'POS Condition Code',
      'Cardholder Name', 'Cardholder Email', 'Cardholder IP Address', 'AVS Response',
      'CVV Response', '3DS Status', 'Risk Score', 'Fraud Flag', 'Chargeback Indicator',
      'Chargeback Reason Code', 'Dispute Reference', 'Refund Indicator', 'Refund Amount',
      'Refund Date', 'Original Authorisation ID', 'Reversal Indicator', 'Funding Status',
      'Funding Date', 'Hold Indicator', 'Hold Release Date',
    ] },

  // ── Databases ──
  { id: 'db-01', name: 'SAP ERP: AP Module',      type: 'database', subtype: 'Oracle · 1.2M rows',    createdAt: dayOffset(0) },
  { id: 'db-02', name: 'Vendor Master Data',      type: 'database', subtype: 'PostgreSQL · 892 rows', createdAt: dayOffset(2) },
  { id: 'db-03', name: 'GL Transaction History',  type: 'database', subtype: 'Snowflake · 3.8M rows', createdAt: dayOffset(5) },
  { id: 'db-04', name: 'Workday HRIS',            type: 'database', subtype: 'PostgreSQL · 234 rows', createdAt: dayOffset(10) },
  { id: 'db-05', name: 'Amazon Athena connection', type: 'database', subtype: 'Athena · ap-south-1',  createdAt: '2026-05-05',
    columns: ['query_id', 'query_text', 'rows_scanned', 'bytes_scanned', 'duration_ms', 'status'] },

  // ── Session files (chat-attached) ──
  { id: 'sf-01', name: 'IRA chat — JE anomaly samples',  type: 'session', subtype: 'CSV · linked to ch-005', createdAt: dayOffset(0) },
  { id: 'sf-02', name: 'IRA chat — Vendor concentration', type: 'session', subtype: 'XLSX · linked to ch-002', createdAt: dayOffset(2) },
  { id: 'sf-03', name: 'IRA chat — SOX deficiencies',    type: 'session', subtype: 'PDF · linked to ch-003',  createdAt: dayOffset(8) },
  { id: 'sf-04', name: 'IRA chat — Privileged access',   type: 'session', subtype: 'CSV · linked to ch-001',  createdAt: dayOffset(14) },
];

export const INTEGRATED_TYPES: SourceType[] = ['database', 'session'];

export const TYPE_META: Record<SourceType, { icon: React.ElementType; tone: string; label: string }> = {
  file:     { icon: FileText,       tone: 'text-brand-700 bg-brand-50',         label: 'File' },
  database: { icon: Database,       tone: 'text-evidence-700 bg-evidence-50',   label: 'Database' },
  session:  { icon: MessageSquare,  tone: 'text-ink-700 bg-paper-100',          label: 'Session file' },
};

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
