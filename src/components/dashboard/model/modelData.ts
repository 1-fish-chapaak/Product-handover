import type { ModelTable, Relationship } from './relationshipTypes';
import { CHOCOLATE_TABLES } from './chocolateSalesData';

// ─── Audit / Procurement star schema (with real rows) ───
// Invoices (fact) + Vendors, Departments, Calendar, Payment Methods (dims),
// plus a second Payments fact that deliberately shares several columns with
// Invoices (InvoiceID, VendorID, DateKey, Amount) to exercise the edge cases.

export const MODEL_TABLES: ModelTable[] = [
  {
    id: 'invoices',
    name: 'Invoices',
    columns: [
      { name: 'InvoiceID', label: 'Invoice ID', type: 'string', role: 'dimension', isKey: true },
      { name: 'VendorID', label: 'Vendor ID', type: 'string', role: 'dimension', isKey: true },
      { name: 'DeptID', label: 'Department ID', type: 'string', role: 'dimension', isKey: true },
      { name: 'DateKey', label: 'Date Key', type: 'string', role: 'dimension', isKey: true },
      { name: 'MethodID', label: 'Method ID', type: 'string', role: 'dimension', isKey: true },
      { name: 'InvoiceDate', label: 'Invoice Date', type: 'date', role: 'dimension' },
      { name: 'Status', label: 'Status', type: 'string', role: 'dimension' },
      { name: 'Amount', label: 'Invoice Amount (₹)', type: 'number', role: 'measure' },
      { name: 'AmountAtRisk', label: 'Amount at Risk (₹)', type: 'number', role: 'measure' },
      { name: 'DuplicateCount', label: 'Duplicate Count', type: 'number', role: 'measure' },
    ],
    rows: [
      { InvoiceID: 'INV001', VendorID: 'V01', DeptID: 'D01', DateKey: 'M01', MethodID: 'PM1', InvoiceDate: '2026-01-06', Status: 'Closed', Amount: 120000, AmountAtRisk: 8000, DuplicateCount: 0 },
      { InvoiceID: 'INV002', VendorID: 'V02', DeptID: 'D01', DateKey: 'M01', MethodID: 'PM2', InvoiceDate: '2026-01-19', Status: 'Closed', Amount: 85000, AmountAtRisk: 0, DuplicateCount: 0 },
      { InvoiceID: 'INV003', VendorID: 'V03', DeptID: 'D02', DateKey: 'M02', MethodID: 'PM1', InvoiceDate: '2026-02-04', Status: 'Flagged', Amount: 240000, AmountAtRisk: 24000, DuplicateCount: 2 },
      { InvoiceID: 'INV004', VendorID: 'V01', DeptID: 'D03', DateKey: 'M02', MethodID: 'PM3', InvoiceDate: '2026-02-17', Status: 'Closed', Amount: 60000, AmountAtRisk: 0, DuplicateCount: 0 },
      { InvoiceID: 'INV005', VendorID: 'V04', DeptID: 'D02', DateKey: 'M03', MethodID: 'PM1', InvoiceDate: '2026-03-03', Status: 'Open', Amount: 150000, AmountAtRisk: 5000, DuplicateCount: 1 },
      { InvoiceID: 'INV006', VendorID: 'V05', DeptID: 'D01', DateKey: 'M03', MethodID: 'PM2', InvoiceDate: '2026-03-21', Status: 'Closed', Amount: 95000, AmountAtRisk: 0, DuplicateCount: 0 },
      { InvoiceID: 'INV007', VendorID: 'V03', DeptID: 'D04', DateKey: 'M04', MethodID: 'PM1', InvoiceDate: '2026-04-08', Status: 'Flagged', Amount: 310000, AmountAtRisk: 31000, DuplicateCount: 3 },
      { InvoiceID: 'INV008', VendorID: 'V02', DeptID: 'D03', DateKey: 'M04', MethodID: 'PM2', InvoiceDate: '2026-04-24', Status: 'Closed', Amount: 72000, AmountAtRisk: 0, DuplicateCount: 0 },
      { InvoiceID: 'INV009', VendorID: 'V01', DeptID: 'D02', DateKey: 'M05', MethodID: 'PM1', InvoiceDate: '2026-05-08', Status: 'Open', Amount: 140000, AmountAtRisk: 9000, DuplicateCount: 1 },
      { InvoiceID: 'INV010', VendorID: 'V04', DeptID: 'D01', DateKey: 'M05', MethodID: 'PM3', InvoiceDate: '2026-05-19', Status: 'Closed', Amount: 50000, AmountAtRisk: 0, DuplicateCount: 0 },
      { InvoiceID: 'INV011', VendorID: 'V05', DeptID: 'D04', DateKey: 'M06', MethodID: 'PM2', InvoiceDate: '2026-06-02', Status: 'Open', Amount: 88000, AmountAtRisk: 4000, DuplicateCount: 0 },
      { InvoiceID: 'INV012', VendorID: 'V03', DeptID: 'D02', DateKey: 'M06', MethodID: 'PM1', InvoiceDate: '2026-06-16', Status: 'Flagged', Amount: 265000, AmountAtRisk: 26000, DuplicateCount: 2 },
      { InvoiceID: 'INV013', VendorID: 'V02', DeptID: 'D01', DateKey: 'M02', MethodID: 'PM1', InvoiceDate: '2026-02-25', Status: 'Closed', Amount: 110000, AmountAtRisk: 0, DuplicateCount: 0 },
      { InvoiceID: 'INV014', VendorID: 'V01', DeptID: 'D03', DateKey: 'M03', MethodID: 'PM2', InvoiceDate: '2026-03-12', Status: 'Closed', Amount: 67000, AmountAtRisk: 0, DuplicateCount: 0 },
      { InvoiceID: 'INV015', VendorID: 'V04', DeptID: 'D04', DateKey: 'M04', MethodID: 'PM1', InvoiceDate: '2026-04-15', Status: 'Open', Amount: 175000, AmountAtRisk: 7000, DuplicateCount: 1 },
      { InvoiceID: 'INV016', VendorID: 'V05', DeptID: 'D02', DateKey: 'M05', MethodID: 'PM3', InvoiceDate: '2026-05-27', Status: 'Closed', Amount: 92000, AmountAtRisk: 0, DuplicateCount: 0 },
      { InvoiceID: 'INV017', VendorID: 'V03', DeptID: 'D01', DateKey: 'M06', MethodID: 'PM1', InvoiceDate: '2026-06-23', Status: 'Flagged', Amount: 280000, AmountAtRisk: 28000, DuplicateCount: 3 },
      { InvoiceID: 'INV018', VendorID: 'V02', DeptID: 'D02', DateKey: 'M01', MethodID: 'PM2', InvoiceDate: '2026-01-28', Status: 'Closed', Amount: 78000, AmountAtRisk: 0, DuplicateCount: 0 },
      // ── H2 2026 — so a "May vs Aug" (or any period) comparison has data. Aug is
      // seeded worse than May, driven by Finance (D02): more amount at risk, more
      // duplicates. Other months stay moderate.
      { InvoiceID: 'INV019', VendorID: 'V02', DeptID: 'D01', DateKey: 'M07', MethodID: 'PM2', InvoiceDate: '2026-07-07', Status: 'Closed', Amount: 102000, AmountAtRisk: 0, DuplicateCount: 0 },
      { InvoiceID: 'INV020', VendorID: 'V04', DeptID: 'D03', DateKey: 'M07', MethodID: 'PM1', InvoiceDate: '2026-07-16', Status: 'Open', Amount: 134000, AmountAtRisk: 6000, DuplicateCount: 1 },
      { InvoiceID: 'INV021', VendorID: 'V05', DeptID: 'D04', DateKey: 'M07', MethodID: 'PM3', InvoiceDate: '2026-07-29', Status: 'Closed', Amount: 64000, AmountAtRisk: 0, DuplicateCount: 0 },
      { InvoiceID: 'INV022', VendorID: 'V03', DeptID: 'D02', DateKey: 'M08', MethodID: 'PM1', InvoiceDate: '2026-08-05', Status: 'Flagged', Amount: 320000, AmountAtRisk: 32000, DuplicateCount: 3 },
      { InvoiceID: 'INV023', VendorID: 'V01', DeptID: 'D03', DateKey: 'M08', MethodID: 'PM2', InvoiceDate: '2026-08-14', Status: 'Open', Amount: 95000, AmountAtRisk: 6000, DuplicateCount: 1 },
      { InvoiceID: 'INV024', VendorID: 'V04', DeptID: 'D01', DateKey: 'M08', MethodID: 'PM1', InvoiceDate: '2026-08-26', Status: 'Closed', Amount: 130000, AmountAtRisk: 0, DuplicateCount: 0 },
      { InvoiceID: 'INV025', VendorID: 'V01', DeptID: 'D01', DateKey: 'M09', MethodID: 'PM2', InvoiceDate: '2026-09-03', Status: 'Closed', Amount: 118000, AmountAtRisk: 0, DuplicateCount: 0 },
      { InvoiceID: 'INV026', VendorID: 'V03', DeptID: 'D04', DateKey: 'M09', MethodID: 'PM1', InvoiceDate: '2026-09-17', Status: 'Flagged', Amount: 210000, AmountAtRisk: 14000, DuplicateCount: 1 },
      { InvoiceID: 'INV027', VendorID: 'V02', DeptID: 'D02', DateKey: 'M09', MethodID: 'PM3', InvoiceDate: '2026-09-25', Status: 'Open', Amount: 76000, AmountAtRisk: 3000, DuplicateCount: 0 },
      { InvoiceID: 'INV028', VendorID: 'V05', DeptID: 'D01', DateKey: 'M10', MethodID: 'PM1', InvoiceDate: '2026-10-06', Status: 'Closed', Amount: 99000, AmountAtRisk: 0, DuplicateCount: 0 },
      { InvoiceID: 'INV029', VendorID: 'V04', DeptID: 'D02', DateKey: 'M10', MethodID: 'PM2', InvoiceDate: '2026-10-15', Status: 'Open', Amount: 156000, AmountAtRisk: 8000, DuplicateCount: 1 },
      { InvoiceID: 'INV030', VendorID: 'V01', DeptID: 'D03', DateKey: 'M10', MethodID: 'PM1', InvoiceDate: '2026-10-28', Status: 'Closed', Amount: 71000, AmountAtRisk: 0, DuplicateCount: 0 },
      { InvoiceID: 'INV031', VendorID: 'V03', DeptID: 'D02', DateKey: 'M11', MethodID: 'PM1', InvoiceDate: '2026-11-04', Status: 'Flagged', Amount: 245000, AmountAtRisk: 19000, DuplicateCount: 2 },
      { InvoiceID: 'INV032', VendorID: 'V02', DeptID: 'D04', DateKey: 'M11', MethodID: 'PM2', InvoiceDate: '2026-11-18', Status: 'Closed', Amount: 83000, AmountAtRisk: 0, DuplicateCount: 0 },
      { InvoiceID: 'INV033', VendorID: 'V05', DeptID: 'D03', DateKey: 'M11', MethodID: 'PM3', InvoiceDate: '2026-11-27', Status: 'Open', Amount: 61000, AmountAtRisk: 2000, DuplicateCount: 0 },
      { InvoiceID: 'INV034', VendorID: 'V01', DeptID: 'D01', DateKey: 'M12', MethodID: 'PM1', InvoiceDate: '2026-12-02', Status: 'Closed', Amount: 125000, AmountAtRisk: 0, DuplicateCount: 0 },
      { InvoiceID: 'INV035', VendorID: 'V04', DeptID: 'D04', DateKey: 'M12', MethodID: 'PM2', InvoiceDate: '2026-12-11', Status: 'Open', Amount: 142000, AmountAtRisk: 5000, DuplicateCount: 1 },
      { InvoiceID: 'INV036', VendorID: 'V03', DeptID: 'D02', DateKey: 'M12', MethodID: 'PM1', InvoiceDate: '2026-12-19', Status: 'Flagged', Amount: 190000, AmountAtRisk: 11000, DuplicateCount: 1 },
    ],
  },
  {
    id: 'vendors',
    name: 'Vendors',
    columns: [
      { name: 'VendorID', label: 'Vendor ID', type: 'string', role: 'dimension', isKey: true },
      { name: 'VendorName', label: 'Vendor Name', type: 'string', role: 'dimension' },
      { name: 'Region', label: 'Region', type: 'string', role: 'dimension' },
      { name: 'RiskScore', label: 'Risk Score', type: 'number', role: 'measure' },
    ],
    rows: [
      { VendorID: 'V01', VendorName: 'Apex Components', Region: 'North', RiskScore: 72 },
      { VendorID: 'V02', VendorName: 'BlueRiver Supplies', Region: 'West', RiskScore: 45 },
      { VendorID: 'V03', VendorName: 'Crestline Logistics', Region: 'South', RiskScore: 88 },
      { VendorID: 'V04', VendorName: 'Delta Pharma', Region: 'East', RiskScore: 30 },
      { VendorID: 'V05', VendorName: 'Evergreen Foods', Region: 'North', RiskScore: 61 },
    ],
  },
  {
    id: 'departments',
    name: 'Departments',
    columns: [
      { name: 'DeptID', label: 'Department ID', type: 'string', role: 'dimension', isKey: true },
      { name: 'Department', label: 'Department', type: 'string', role: 'dimension' },
      { name: 'Owner', label: 'Owner', type: 'string', role: 'dimension' },
    ],
    rows: [
      { DeptID: 'D01', Department: 'Procurement', Owner: 'Tushar Goel' },
      { DeptID: 'D02', Department: 'Finance', Owner: 'Deepak Bansal' },
      { DeptID: 'D03', Department: 'Operations', Owner: 'Neha Joshi' },
      { DeptID: 'D04', Department: 'IT', Owner: 'Karan Mehta' },
    ],
  },
  {
    id: 'calendar',
    name: 'Calendar',
    columns: [
      { name: 'DateKey', label: 'Date Key', type: 'string', role: 'dimension', isKey: true },
      { name: 'Month', label: 'Month', type: 'string', role: 'dimension' },
      { name: 'Quarter', label: 'Quarter', type: 'string', role: 'dimension' },
      { name: 'Year', label: 'Year', type: 'number', role: 'dimension' },
    ],
    rows: [
      { DateKey: 'M01', Month: 'Jan', Quarter: 'Q1', Year: 2026 },
      { DateKey: 'M02', Month: 'Feb', Quarter: 'Q1', Year: 2026 },
      { DateKey: 'M03', Month: 'Mar', Quarter: 'Q1', Year: 2026 },
      { DateKey: 'M04', Month: 'Apr', Quarter: 'Q2', Year: 2026 },
      { DateKey: 'M05', Month: 'May', Quarter: 'Q2', Year: 2026 },
      { DateKey: 'M06', Month: 'Jun', Quarter: 'Q2', Year: 2026 },
      { DateKey: 'M07', Month: 'Jul', Quarter: 'Q3', Year: 2026 },
      { DateKey: 'M08', Month: 'Aug', Quarter: 'Q3', Year: 2026 },
      { DateKey: 'M09', Month: 'Sep', Quarter: 'Q3', Year: 2026 },
      { DateKey: 'M10', Month: 'Oct', Quarter: 'Q4', Year: 2026 },
      { DateKey: 'M11', Month: 'Nov', Quarter: 'Q4', Year: 2026 },
      { DateKey: 'M12', Month: 'Dec', Quarter: 'Q4', Year: 2026 },
    ],
  },
  {
    id: 'paymentMethods',
    name: 'Payment Methods',
    columns: [
      { name: 'MethodID', label: 'Method ID', type: 'string', role: 'dimension', isKey: true },
      { name: 'Method', label: 'Method', type: 'string', role: 'dimension' },
      { name: 'Channel', label: 'Channel', type: 'string', role: 'dimension' },
    ],
    rows: [
      { MethodID: 'PM1', Method: 'Bank Transfer', Channel: 'ACH' },
      { MethodID: 'PM2', Method: 'Corporate Card', Channel: 'Online' },
      { MethodID: 'PM3', Method: 'Cheque', Channel: 'Manual' },
    ],
  },
  {
    id: 'payments',
    name: 'Payments',
    columns: [
      { name: 'PaymentID', label: 'Payment ID', type: 'string', role: 'dimension', isKey: true },
      { name: 'InvoiceID', label: 'Invoice ID', type: 'string', role: 'dimension', isKey: true },
      { name: 'VendorID', label: 'Vendor ID', type: 'string', role: 'dimension', isKey: true },
      { name: 'DateKey', label: 'Date Key', type: 'string', role: 'dimension', isKey: true },
      { name: 'PaidDate', label: 'Paid Date', type: 'date', role: 'dimension' },
      { name: 'Method', label: 'Method', type: 'string', role: 'dimension' },
      { name: 'Amount', label: 'Paid Amount (₹)', type: 'number', role: 'measure' },
    ],
    rows: [
      { PaymentID: 'PAY001', InvoiceID: 'INV001', VendorID: 'V01', DateKey: 'M01', PaidDate: '2026-01-20', Method: 'Bank Transfer', Amount: 120000 },
      { PaymentID: 'PAY002', InvoiceID: 'INV002', VendorID: 'V02', DateKey: 'M01', PaidDate: '2026-01-30', Method: 'Corporate Card', Amount: 85000 },
      { PaymentID: 'PAY003', InvoiceID: 'INV004', VendorID: 'V01', DateKey: 'M02', PaidDate: '2026-02-27', Method: 'Cheque', Amount: 60000 },
      { PaymentID: 'PAY004', InvoiceID: 'INV005', VendorID: 'V04', DateKey: 'M03', PaidDate: '2026-03-18', Method: 'Bank Transfer', Amount: 150000 },
      { PaymentID: 'PAY005', InvoiceID: 'INV006', VendorID: 'V05', DateKey: 'M03', PaidDate: '2026-03-30', Method: 'Corporate Card', Amount: 95000 },
      { PaymentID: 'PAY006', InvoiceID: 'INV008', VendorID: 'V02', DateKey: 'M04', PaidDate: '2026-04-30', Method: 'Corporate Card', Amount: 72000 },
      { PaymentID: 'PAY007', InvoiceID: 'INV010', VendorID: 'V04', DateKey: 'M05', PaidDate: '2026-05-29', Method: 'Cheque', Amount: 50000 },
      { PaymentID: 'PAY008', InvoiceID: 'INV013', VendorID: 'V02', DateKey: 'M02', PaidDate: '2026-02-28', Method: 'Bank Transfer', Amount: 110000 },
      { PaymentID: 'PAY009', InvoiceID: 'INV014', VendorID: 'V01', DateKey: 'M03', PaidDate: '2026-03-26', Method: 'Corporate Card', Amount: 67000 },
      { PaymentID: 'PAY010', InvoiceID: 'INV016', VendorID: 'V05', DateKey: 'M05', PaidDate: '2026-05-31', Method: 'Cheque', Amount: 92000 },
      { PaymentID: 'PAY011', InvoiceID: 'INV018', VendorID: 'V02', DateKey: 'M01', PaidDate: '2026-01-31', Method: 'Corporate Card', Amount: 78000 },
      { PaymentID: 'PAY012', InvoiceID: 'INV009', VendorID: 'V01', DateKey: 'M05', PaidDate: '2026-05-22', Method: 'Bank Transfer', Amount: 140000 },
      { PaymentID: 'PAY013', InvoiceID: 'INV019', VendorID: 'V02', DateKey: 'M07', PaidDate: '2026-07-21', Method: 'Corporate Card', Amount: 102000 },
      { PaymentID: 'PAY014', InvoiceID: 'INV021', VendorID: 'V05', DateKey: 'M07', PaidDate: '2026-07-31', Method: 'Cheque', Amount: 64000 },
      { PaymentID: 'PAY015', InvoiceID: 'INV024', VendorID: 'V04', DateKey: 'M08', PaidDate: '2026-08-28', Method: 'Bank Transfer', Amount: 130000 },
      { PaymentID: 'PAY016', InvoiceID: 'INV025', VendorID: 'V01', DateKey: 'M09', PaidDate: '2026-09-15', Method: 'Corporate Card', Amount: 118000 },
      { PaymentID: 'PAY017', InvoiceID: 'INV028', VendorID: 'V05', DateKey: 'M10', PaidDate: '2026-10-20', Method: 'Bank Transfer', Amount: 99000 },
      { PaymentID: 'PAY018', InvoiceID: 'INV030', VendorID: 'V01', DateKey: 'M10', PaidDate: '2026-10-30', Method: 'Bank Transfer', Amount: 71000 },
      { PaymentID: 'PAY019', InvoiceID: 'INV032', VendorID: 'V02', DateKey: 'M11', PaidDate: '2026-11-25', Method: 'Corporate Card', Amount: 83000 },
      { PaymentID: 'PAY020', InvoiceID: 'INV034', VendorID: 'V01', DateKey: 'M12', PaidDate: '2026-12-15', Method: 'Bank Transfer', Amount: 125000 },
    ],
  },
];

// Star relationships seeded active so multi-table widgets work out of the box.
// `payments` is intentionally left UNconnected — auto-detect / manual joins
// (multiple shared columns) demo the edge cases against it.
export const DEFAULT_RELATIONSHIPS: Relationship[] = [
  { id: 'rel-inv-ven', leftTable: 'invoices', rightTable: 'vendors', columnPairs: [{ left: 'VendorID', right: 'VendorID' }], active: true },
  { id: 'rel-inv-dep', leftTable: 'invoices', rightTable: 'departments', columnPairs: [{ left: 'DeptID', right: 'DeptID' }], active: true },
  { id: 'rel-inv-cal', leftTable: 'invoices', rightTable: 'calendar', columnPairs: [{ left: 'DateKey', right: 'DateKey' }], active: true },
  { id: 'rel-inv-pm', leftTable: 'invoices', rightTable: 'paymentMethods', columnPairs: [{ left: 'MethodID', right: 'MethodID' }], active: true },
];

/** The tables a dashboard is built on. The seed P2P/GRC model is the default;
 *  the Chocolate Sales dashboard carries its own single-sheet model. */
export function tablesForDashboard(dashboardId?: string): ModelTable[] {
  return dashboardId === 'choco' ? CHOCOLATE_TABLES : MODEL_TABLES;
}
