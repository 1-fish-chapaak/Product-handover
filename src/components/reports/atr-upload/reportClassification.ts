// ─── ATR report classification: sections, review types, locations + the
//     duplicate-report-number control ───
// The upload flow captures how a report is classified (Section, Review Type,
// Audit Location) plus a Report Number. The Report Number must be unique within
// a financial year, tracked SEPARATELY for the Audit and Assurance sections —
// so IA/…/001 in Audit and the same number in Assurance are both allowed, but a
// second Audit report with that number in the same FY is blocked.

export type ReportSection = 'Audit' | 'Assurance';
export type ReviewType = 'Depth' | 'IAR' | 'FSR' | 'FCR';
export type AuditLocation = 'Corporate' | 'Circle' | 'Corporate & Circle';

export const SECTION_OPTIONS: ReportSection[] = ['Audit', 'Assurance'];

export const REVIEW_TYPE_OPTIONS: { value: ReviewType; label: string }[] = [
  { value: 'Depth', label: 'Depth' },
  { value: 'IAR', label: 'IAR — Implementation Assurance Review' },
  { value: 'FSR', label: 'FSR — Full Scope Review' },
  { value: 'FCR', label: 'FCR — Full Circle Review' },
];

export const AUDIT_LOCATION_OPTIONS: AuditLocation[] = ['Corporate', 'Circle', 'Corporate & Circle'];

// Region the audit covers (the "Region" dropdown).
export const REGION_OPTIONS: string[] = ['North', 'South', 'East', 'West'];

// City / circle location (the "Location (City)" dropdown).
export const LOCATION_OPTIONS: string[] = [
  'Delhi',
  'UP West',
  'Rajasthan',
  'Upper North (UN)',
  'Andhra Pradesh (AP)',
  'Karnataka (KK)',
  'Kerala and Tamil Nadu (KTN)',
  'NESA',
  'UP East',
  'Bihar & Jharkhand (B&J)',
  'West Bengal and Orissa (WBO)',
  'Gujarat',
  'Mumbai',
  'Maharashtra and Goa (M&G)',
  'Madhya Pradesh & Chhattisgarh (MPCG)',
];

// The business functions an audit can belong to (the "Function" dropdown).
export const FUNCTION_OPTIONS: string[] = [
  'Finance',
  'Information Technology (IT)',
  'SCM',
  'HR & Admin',
  'Operations',
  'Estate',
  'New Build',
  'Energy',
  'Legal',
  'Quality',
  'Site Solutions & Engineering',
  'ESH',
  'Key Account and Enterprise Sales',
  'Commercials, Business Development & Solutions',
  'Strategy and Business Excellence',
  'Sustainability and New Initiatives',
];

// ─── Financial year ───
// Indian FY runs Apr → Mar. Derive "FY 2025-26" from any date in the period.
export function financialYearOf(date?: string | null): string {
  if (!date) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(date + 'T00:00:00') : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const startYear = d.getMonth() >= 3 ? y : y - 1; // Jan–Mar belongs to the prior FY
  return `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

// ─── Duplicate Report-Number registry (mock) ───
// Seeded with a few "already issued" numbers so the block is demonstrable. The
// key is section + FY + normalised number. Newly-generated ATRs register their
// number so a second upload in the same session is caught too.
export interface ReportNumberEntry {
  /** Section is admin-editable, so kept as a free string. */
  section: string;
  financialYear: string;
  reportNumber: string;
}

const norm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, '');

const SEED_TAKEN: ReportNumberEntry[] = [
  { section: 'Audit',     financialYear: 'FY 2025-26', reportNumber: 'IA/2025-26/001' },
  { section: 'Audit',     financialYear: 'FY 2025-26', reportNumber: 'IA/2025-26/002' },
  { section: 'Assurance', financialYear: 'FY 2025-26', reportNumber: 'AS/2025-26/001' },
  { section: 'Audit',     financialYear: 'FY 2024-25', reportNumber: 'IA/2024-25/017' },
];

const taken = new Map<string, ReportNumberEntry>();
const keyOf = (section: string, fy: string, num: string) => `${section}::${fy}::${norm(num)}`;
SEED_TAKEN.forEach(e => taken.set(keyOf(e.section, e.financialYear, e.reportNumber), e));

/** True if this Report Number is already issued for the given section + FY. */
export function isReportNumberTaken(section: string, financialYear: string, reportNumber: string): boolean {
  if (!section || !financialYear || !reportNumber.trim()) return false;
  return taken.has(keyOf(section, financialYear, reportNumber));
}

/** Register a number once its report is generated, so later uploads collide. */
export function registerReportNumber(section: string, financialYear: string, reportNumber: string): void {
  if (!section || !financialYear || !reportNumber.trim()) return;
  taken.set(keyOf(section, financialYear, reportNumber), { section, financialYear, reportNumber: reportNumber.trim() });
}
