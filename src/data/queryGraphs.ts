// Graphs that have been generated in chat sessions for each query.
// Surfaced in the QueryCard's "Add Graph" modal — user picks one to attach
// to the card. Renders via the project's canonical ConfigurableChart so the
// look matches chat + dashboard exactly. Reports lock down editing; that's
// the only difference vs the dashboard rendering.

export type QueryGraph = {
  id: string;
  title: string;
  type: 'bar' | 'line' | 'pie' | 'area';
  xAxis: string;
  yAxis?: string;
  color?: string;
};

export const QUERY_GRAPHS: Record<string, QueryGraph[]> = {
  Q01: [
    { id: 'q01-g1', title: 'Duplicates by vendor', type: 'pie', xAxis: 'Vendor Name' },
    { id: 'q01-g2', title: 'Duplicate detection trend', type: 'line', xAxis: 'Month', yAxis: 'Duplicate Count' },
    { id: 'q01-g3', title: 'Resolution status', type: 'pie', xAxis: 'Status' },
    { id: 'q01-g4', title: 'Cumulative duplicates', type: 'area', xAxis: 'Month', yAxis: 'Duplicate Count' },
  ],
  Q02: [
    { id: 'q02-g1', title: 'Changes by department', type: 'bar', xAxis: 'Department' },
    { id: 'q02-g2', title: 'Authorization status', type: 'pie', xAxis: 'Status' },
    { id: 'q02-g3', title: 'Changes over time', type: 'line', xAxis: 'Month', yAxis: 'Duplicate Count' },
  ],
  RA01: [
    { id: 'ra01-g1', title: 'Risks by process area', type: 'pie', xAxis: 'Department' },
    { id: 'ra01-g2', title: 'Risk count by region', type: 'bar', xAxis: 'Region' },
  ],
  RA02: [
    { id: 'ra02-g1', title: 'Mitigation effectiveness', type: 'pie', xAxis: 'Status' },
    { id: 'ra02-g2', title: 'Strategies reviewed by quarter', type: 'bar', xAxis: 'Quarter' },
  ],
  CE01: [
    { id: 'ce01-g1', title: 'Controls tested by department', type: 'bar', xAxis: 'Department' },
    { id: 'ce01-g2', title: 'Effectiveness trend', type: 'line', xAxis: 'Month', yAxis: 'Duplicate Score (%)' },
    { id: 'ce01-g3', title: 'Coverage by control family', type: 'pie', xAxis: 'Category' },
  ],
  WA01: [
    { id: 'wa01-g1', title: 'Workflow accuracy trend', type: 'line', xAxis: 'Month', yAxis: 'Duplicate Score (%)' },
    { id: 'wa01-g2', title: 'Runs per workflow', type: 'bar', xAxis: 'Quarter' },
  ],
  WA02: [
    { id: 'wa02-g1', title: 'Exception resolution path', type: 'pie', xAxis: 'Status' },
    { id: 'wa02-g2', title: 'Daily exception count', type: 'area', xAxis: 'Week', yAxis: 'Duplicate Count' },
  ],
  EX01: [
    { id: 'ex01-g1', title: 'Compliance score trend', type: 'line', xAxis: 'Quarter', yAxis: 'Duplicate Score (%)' },
    { id: 'ex01-g2', title: 'Risk exposure by region', type: 'bar', xAxis: 'Region' },
    { id: 'ex01-g3', title: 'Material weakness status', type: 'pie', xAxis: 'Status' },
  ],
};

// Sample results table per query — surfaced as the "Results Table" section in
// the QueryCard's "Choose What to Include" modal and rendered on the card when
// attached. Mirrors the chat result's table shape (columns + rows).
export type QueryTable = {
  columns: string[];
  rows: string[][];
};

export const QUERY_TABLES: Record<string, QueryTable> = {
  Q01: {
    columns: ['Case ID', 'Vendor', 'Invoice Date', 'Invoice Value', 'Match %', 'Status'],
    rows: [
      ['CASE_000007', 'VENDOR_002', '14 Feb 2026', '₹2.42Cr', '96%', 'Open'],
      ['CASE_000012', 'VENDOR_006', '03 Mar 2026', '₹89.40L', '94%', 'Open'],
      ['CASE_000019', 'VENDOR_006', '21 Jan 2026', '₹21.19L', '91%', 'In Review'],
      ['CASE_000024', 'VENDOR_011', '09 Mar 2026', '₹10.03L', '89%', 'Open'],
      ['CASE_000031', 'VENDOR_002', '27 Feb 2026', '₹6.83L', '88%', 'In Review'],
      ['CASE_000045', 'VENDOR_018', '05 Jan 2026', '₹0.63L', '85%', 'Resolved'],
    ],
  },
  Q02: {
    columns: ['Change ID', 'Vendor', 'Field Changed', 'Changed By', 'Approval', 'Date'],
    rows: [
      ['CHG_0312', 'VENDOR_015', 'Bank Account', 'j.menon', 'Missing', '11 Mar 2026'],
      ['CHG_0318', 'VENDOR_015', 'Bank Account', 'j.menon', 'Missing', '12 Mar 2026'],
      ['CHG_0341', 'VENDOR_015', 'Remit-To Address', 'j.menon', 'Missing', '14 Mar 2026'],
      ['CHG_0357', 'VENDOR_015', 'Bank Account', 'j.menon', 'Missing', '16 Mar 2026'],
      ['CHG_0402', 'VENDOR_088', 'Bank Account', 's.rao', 'Missing', '02 Apr 2026'],
      ['CHG_0419', 'VENDOR_120', 'Payment Terms', 'a.khan', 'Approved', '07 Apr 2026'],
    ],
  },
  RA01: {
    columns: ['Risk ID', 'Process Area', 'Region', 'Likelihood', 'Impact', 'Rating'],
    rows: [
      ['RISK_A07', 'Procure-to-Pay', 'India', 'High', 'High', 'Critical'],
      ['RISK_A12', 'Order-to-Cash', 'UAE', 'Medium', 'High', 'High'],
      ['RISK_A19', 'Record-to-Report', 'EMEA', 'Medium', 'Medium', 'Moderate'],
      ['RISK_A23', 'Procure-to-Pay', 'APAC', 'High', 'Medium', 'High'],
      ['RISK_A31', 'Hire-to-Retire', 'India', 'Low', 'Medium', 'Moderate'],
      ['RISK_A38', 'Treasury', 'UAE', 'Medium', 'High', 'High'],
    ],
  },
  RA02: {
    columns: ['Strategy ID', 'Linked Risk', 'Owner', 'Status', 'Last Review', 'Effectiveness'],
    rows: [
      ['MIT_204', 'RISK_A07', 'Controls Team', 'Active', '28 Feb 2026', 'Effective'],
      ['MIT_211', 'RISK_A12', 'Finance Ops', 'Active', '12 Mar 2026', 'Partial'],
      ['MIT_218', 'RISK_A19', 'IT GRC', 'Under Review', '04 Mar 2026', 'Partial'],
      ['MIT_225', 'RISK_A23', 'Controls Team', 'Active', '19 Feb 2026', 'Effective'],
      ['MIT_232', 'RISK_A31', 'HR Shared Svc', 'Lapsed', '09 Jan 2026', 'Ineffective'],
      ['MIT_240', 'RISK_A38', 'Treasury', 'Active', '21 Mar 2026', 'Effective'],
    ],
  },
  CE01: {
    columns: ['Control ID', 'Department', 'Tests Run', 'Pass Rate', 'Last Tested', 'Result'],
    rows: [
      ['CTRL_1001', 'Accounts Payable', '120', '94%', '15 Mar 2026', 'Pass'],
      ['CTRL_1007', 'Procurement', '96', '88%', '12 Mar 2026', 'Pass'],
      ['CTRL_1014', 'Treasury', '64', '72%', '08 Mar 2026', 'Exceptions'],
      ['CTRL_1022', 'General Ledger', '110', '91%', '14 Mar 2026', 'Pass'],
      ['CTRL_1030', 'Payroll', '48', '65%', '02 Mar 2026', 'Fail'],
      ['CTRL_1041', 'Fixed Assets', '72', '83%', '10 Mar 2026', 'Exceptions'],
    ],
  },
  WA01: {
    columns: ['Run ID', 'Workflow', 'Records', 'Accuracy', 'Run Date', 'Status'],
    rows: [
      ['RUN_5582', 'Duplicate Detection', '12,480', '96.2%', '20 Mar 2026', 'Completed'],
      ['RUN_5588', 'Three-Way Match', '8,734', '93.7%', '19 Mar 2026', 'Completed'],
      ['RUN_5591', 'Vendor Screening', '1,843', '90.1%', '18 Mar 2026', 'Completed'],
      ['RUN_5604', 'GL Anomaly Scan', '21,002', '88.4%', '17 Mar 2026', 'Review'],
      ['RUN_5610', 'Duplicate Detection', '12,510', '95.8%', '16 Mar 2026', 'Completed'],
      ['RUN_5617', 'Three-Way Match', '8,690', '94.0%', '15 Mar 2026', 'Completed'],
    ],
  },
  WA02: {
    columns: ['Exception ID', 'Type', 'Raised On', 'Resolution', 'Age (days)', 'Status'],
    rows: [
      ['EXC_7741', 'Match Break', '18 Mar 2026', 'Reassigned', '4', 'Open'],
      ['EXC_7749', 'Missing GRN', '17 Mar 2026', 'Auto-closed', '1', 'Resolved'],
      ['EXC_7752', 'Price Variance', '16 Mar 2026', 'Escalated', '6', 'Open'],
      ['EXC_7760', 'Duplicate Flag', '15 Mar 2026', 'Reversed', '2', 'Resolved'],
      ['EXC_7768', 'Tax Mismatch', '14 Mar 2026', 'Pending', '8', 'In Review'],
      ['EXC_7774', 'Match Break', '13 Mar 2026', 'Reassigned', '9', 'In Review'],
    ],
  },
  EX01: {
    columns: ['Control Area', 'Region', 'Score', 'Quarter', 'Weakness', 'Status'],
    rows: [
      ['Revenue Recognition', 'India', '92%', 'Q1 FY26', 'None', 'Compliant'],
      ['Access Controls', 'UAE', '78%', 'Q1 FY26', 'Minor', 'Watch'],
      ['Segregation of Duties', 'EMEA', '64%', 'Q1 FY26', 'Material', 'At Risk'],
      ['Vendor Onboarding', 'India', '85%', 'Q1 FY26', 'Minor', 'Watch'],
      ['Period-End Close', 'APAC', '90%', 'Q1 FY26', 'None', 'Compliant'],
      ['Treasury Controls', 'UAE', '71%', 'Q1 FY26', 'Significant', 'At Risk'],
    ],
  },
};
