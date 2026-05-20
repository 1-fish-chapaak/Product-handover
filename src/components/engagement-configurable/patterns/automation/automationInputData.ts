// ─── Automation Project Input Data — Types & Mock Data ────────────────────

export type DataSourceType = 'EXCEL_CSV' | 'PDF' | 'SQL' | 'IMAGE' | 'HYBRID' | 'EMAIL_ATTACHMENT' | 'OTHER';
export type DataSourceStatus = 'DRAFT' | 'UPLOADED' | 'CONNECTED' | 'NEEDS_MAPPING' | 'READY' | 'FAILED';

export interface AutomationDataSource {
  id: string;
  name: string;
  sourceType: DataSourceType;
  fileName: string;
  connectionName: string;
  recordCount: number | null;
  pageCount: number | null;
  imageCount: number | null;
  uploadedAt: string;
  uploadedBy: string;
  status: DataSourceStatus;
  linkedScope: string;
  description: string;
  columns: string[];
  samplePreviewRows: string[][];
  validationIssues: string[];
  tags: string[];
}

export interface AutomationInputDataState {
  dataSources: AutomationDataSource[];
  selectedSourceIds: string[];
  inputNotes: string;
  proceedWithoutData: boolean;
}

import type { AutomationSetupState } from './automationSetupData';
import type { AutomationRunsState } from './automationRunsData';
import type { AutomationOutputReviewState } from './automationOutputReviewData';
import type { AutomationCasesState } from './automationCasesData';
import type { AutomationReportsState } from './automationReportsData';
import type { AutomationScheduleState } from './automationScheduleData';

export interface AutomationProjectWorkspaceState {
  inputData: AutomationInputDataState;
  setup: AutomationSetupState;
  runs: AutomationRunsState;
  outputReview: AutomationOutputReviewState;
  cases: AutomationCasesState;
  reports: AutomationReportsState;
  schedule: AutomationScheduleState;
}

export const SOURCE_TYPE_LABELS: Record<DataSourceType, string> = {
  EXCEL_CSV: 'Excel / CSV', PDF: 'PDF', SQL: 'SQL', IMAGE: 'Image', HYBRID: 'Hybrid', EMAIL_ATTACHMENT: 'Email', OTHER: 'Other',
};
export const SOURCE_STATUS_CLS: Record<DataSourceStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600', UPLOADED: 'bg-blue-50 text-blue-700', CONNECTED: 'bg-purple-50 text-purple-700',
  NEEDS_MAPPING: 'bg-amber-50 text-amber-700', READY: 'bg-emerald-50 text-emerald-700', FAILED: 'bg-red-50 text-red-700',
};

// ─── Mock Data Generators ─────────────────────────────────────────────────

const ts = () => new Date().toISOString().slice(0, 10);

export function createExcelSource(): AutomationDataSource {
  return {
    id: `ds-${Date.now()}`, name: 'Vendor Ledger Extract', sourceType: 'EXCEL_CSV',
    fileName: 'vendor_ledger_april.xlsx', connectionName: '', recordCount: 2500, pageCount: null, imageCount: null,
    uploadedAt: ts(), uploadedBy: 'User', status: 'READY', linkedScope: 'Vendor Reconciliation', description: 'Vendor ledger extract for April 2026.',
    columns: ['vendor_id', 'vendor_name', 'invoice_no', 'invoice_date', 'amount', 'payment_status'],
    samplePreviewRows: [
      ['V001', 'Vendor A', 'INV-1001', '2026-04-01', '45000', 'Paid'],
      ['V002', 'Vendor B', 'INV-1002', '2026-04-03', '62000', 'Pending'],
      ['V001', 'Vendor A', 'INV-1003', '2026-04-05', '45000', 'Paid'],
    ],
    validationIssues: [], tags: ['vendor', 'ledger', 'P2P'],
  };
}

export function createPDFSource(): AutomationDataSource {
  return {
    id: `ds-${Date.now()}`, name: 'Vendor Invoice Pack', sourceType: 'PDF',
    fileName: 'vendor_invoice_pack.pdf', connectionName: '', recordCount: null, pageCount: 42, imageCount: null,
    uploadedAt: ts(), uploadedBy: 'User', status: 'NEEDS_MAPPING', linkedScope: 'Invoice Validation', description: 'Pack of vendor invoices for reconciliation.',
    columns: [], samplePreviewRows: [],
    validationIssues: ['Document type mapping required'], tags: ['invoices', 'PDF'],
  };
}

export function createSQLSource(): AutomationDataSource {
  return {
    id: `ds-${Date.now()}`, name: 'Payments SQL Extract', sourceType: 'SQL',
    fileName: '', connectionName: 'finance_prod.payments_q1', recordCount: 10000, pageCount: null, imageCount: null,
    uploadedAt: ts(), uploadedBy: 'System', status: 'CONNECTED', linkedScope: 'Payment Reconciliation', description: 'Q1 payment transactions from finance system.',
    columns: ['txn_id', 'vendor_id', 'amount', 'payment_date', 'status', 'reference'],
    samplePreviewRows: [
      ['TXN-001', 'V001', '45000', '2026-04-02', 'Completed', 'INV-1001'],
      ['TXN-002', 'V002', '62000', '2026-04-04', 'Pending', 'INV-1002'],
    ],
    validationIssues: [], tags: ['payments', 'SQL'],
  };
}

export function createImageSource(): AutomationDataSource {
  return {
    id: `ds-${Date.now()}`, name: 'Asset Image Batch', sourceType: 'IMAGE',
    fileName: 'asset_images_batch1.zip', connectionName: '', recordCount: null, pageCount: null, imageCount: 120,
    uploadedAt: ts(), uploadedBy: 'User', status: 'READY', linkedScope: 'Asset Verification', description: '120 asset images for automated verification.',
    columns: [], samplePreviewRows: [],
    validationIssues: [], tags: ['images', 'assets'],
  };
}

export function createHybridSources(): AutomationDataSource[] {
  return [createExcelSource(), { ...createSQLSource(), id: `ds-${Date.now() + 1}` }];
}

export type InputDataReadiness = 'Not Ready' | 'Needs Mapping' | 'Ready';

export function deriveInputDataReadiness(state: AutomationInputDataState): InputDataReadiness {
  if (state.proceedWithoutData) return 'Ready';
  if (state.dataSources.length === 0) return 'Not Ready';
  const selected = state.dataSources.filter(d => state.selectedSourceIds.includes(d.id));
  if (selected.length === 0) return 'Not Ready';
  if (selected.some(d => d.status === 'NEEDS_MAPPING')) return 'Needs Mapping';
  if (selected.some(d => d.status === 'READY' || d.status === 'CONNECTED' || d.status === 'UPLOADED')) return 'Ready';
  return 'Not Ready';
}

export function deriveInputDataSummary(state: AutomationInputDataState) {
  const selected = state.dataSources.filter(d => state.selectedSourceIds.includes(d.id));
  return {
    totalSources: state.dataSources.length,
    readySources: state.dataSources.filter(d => d.status === 'READY' || d.status === 'CONNECTED').length,
    needsMapping: state.dataSources.filter(d => d.status === 'NEEDS_MAPPING').length,
    totalRecords: state.dataSources.reduce((s, d) => s + (d.recordCount || d.pageCount || d.imageCount || 0), 0),
    validationIssues: state.dataSources.reduce((s, d) => s + d.validationIssues.length, 0),
    selectedCount: selected.length,
  };
}
