/**
 * The consolidated report request — every file the standard library needs,
 * grouped by the system it comes from, and the PBC list the auditor sends
 * to the client's IT team. Shared by the Control Library's first-time panel
 * and the standard-library banner on other pages.
 */
import { CHECK_CATALOG, type RequiredFile } from '../../data/auditPlan';

const SYSTEM_OF: Record<string, string> = {
  pa0001: 'HR system (SAP HCM / Workday)',
  doa: 'Policies & rule-sets',
  sod: 'Policies & rule-sets',
  chg: 'IT service management',
};
export const systemOf = (fileId: string) => SYSTEM_OF[fileId] ?? 'SAP ERP';
export const SYSTEM_ORDER = ['SAP ERP', 'HR system (SAP HCM / Workday)', 'IT service management', 'Policies & rule-sets'];

export const controlNameOf = (key: string) => CHECK_CATALOG.find(e => e.key === key)?.controlTitle ?? key;

/** Required files grouped by source system, in a stable order. */
export function bySystem(required: RequiredFile[]): { system: string; files: RequiredFile[] }[] {
  return SYSTEM_ORDER
    .map(system => ({ system, files: required.filter(r => systemOf(r.file.id) === system) }))
    .filter(g => g.files.length > 0);
}

/** CSV the auditor sends to the client — one row per report. */
export function downloadPbc(required: RequiredFile[]) {
  const head = ['#', 'System', 'Report', 'Description', 'Period', 'Format', 'Controls it unlocks', 'Status'];
  const rows = required.map((r, i) => [
    String(i + 1),
    systemOf(r.file.id),
    `${r.file.code} — ${r.file.name}`,
    r.file.hint,
    'Last 12 months (Oct 2025 – Sep 2026)',
    r.file.id === 'doa' || r.file.id === 'sod' ? 'Current signed version (PDF / XLSX)' : 'Full extract, XLSX or CSV',
    r.unlocks.map(controlNameOf).join('; '),
    r.file.matches ? `Connected (${r.file.matches})` : 'Requested',
  ]);
  const csv = [head, ...rows].map(cols => cols.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'PBC-request-list.csv';
  a.click();
  URL.revokeObjectURL(url);
}
