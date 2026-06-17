import type { WorkflowResult } from "../components/reports/ReportsView";

// ─── Business Processes ───
export const BUSINESS_PROCESSES = [
  { id: "p2p", name: "Procure to Pay", abbr: "P2P", color: "#6a12cd", risks: 9, controls: 24, coverage: 72, sops: 2, workflows: 5 },
  { id: "o2c", name: "Order to Cash", abbr: "O2C", color: "#0284c7", risks: 7, controls: 18, coverage: 58, sops: 1, workflows: 3 },
  { id: "s2c", name: "Source to Contract", abbr: "S2C", color: "#8b5cf6", risks: 0, controls: 0, coverage: 0, sops: 0, workflows: 0 },
  { id: "r2r", name: "Record to Report", abbr: "R2R", color: "#d97706", risks: 11, controls: 31, coverage: 85, sops: 3, workflows: 7 },
];

// ─── SOPs ───
export const SOPS = [
  { id: "sop-001", bpId: "p2p", name: "Vendor Payment SOP", version: "v2.1", by: "Tushar Goel", at: "Mar 10, 2026", racmId: "RACM-001", risks: 9, controls: 24, status: "processed" },
  { id: "sop-002", bpId: "p2p", name: "Purchase Order SOP", version: "v1.3", by: "Deepak Bansal", at: "Feb 5, 2026", racmId: "RACM-002", risks: 6, controls: 18, status: "processed" },
  { id: "sop-003", bpId: "o2c", name: "Order to Cash SOP", version: "v1.0", by: "Neha Joshi", at: "Jan 20, 2026", racmId: "RACM-003", risks: 7, controls: 18, status: "processed" },
  { id: "sop-004", bpId: "r2r", name: "Financial Close SOP", version: "v3.0", by: "Karan Mehta", at: "Dec 15, 2025", racmId: "RACM-004", risks: 11, controls: 31, status: "processed" },
  { id: "sop-005", bpId: "r2r", name: "GL Reconciliation SOP", version: "v1.2", by: "Sneha Desai", at: "Jan 10, 2026", racmId: "RACM-005", risks: 5, controls: 15, status: "processed" },
  // Process Hub · P2P SOP list (sourced from the SOP section screenshot)
  { id: "sop-101", bpId: "p2p", name: "memory", version: "v1.0", by: "Kuldeep Pandey", at: "May 5, 2026", racmId: "RACM-101", risks: 0, controls: 0, status: "failed" },
  { id: "sop-102", bpId: "p2p", name: "Sample SOP", version: "v1.0", by: "Kuldeep Pandey", at: "May 6, 2026", racmId: "RACM-102", risks: 6, controls: 16, status: "processed" },
  { id: "sop-103", bpId: "p2p", name: "Sample Flow Chart SOP", version: "v1.0", by: "Kuldeep Pandey", at: "May 6, 2026", racmId: "RACM-103", risks: 0, controls: 0, status: "failed" },
  { id: "sop-104", bpId: "p2p", name: "Testing RACM (4)_RACM", version: "v1.0", by: "Superadmin", at: "May 6, 2026", racmId: "RACM-104", risks: 8, controls: 20, status: "processed" },
  { id: "sop-105", bpId: "p2p", name: "Agrawal Metals - Part 1 - Fixed Assets - SOP", version: "v1.0", by: "Kuldeep Pandey", at: "May 11, 2026", racmId: "RACM-105", risks: 7, controls: 19, status: "processed" },
];

// ─── RACMs ───
export const RACMS = [
  { id: "RACM-001", bpId: "p2p", name: "FY26 P2P · Vendor Payment", fw: "SOX", status: "active", owner: "Tushar Goel", lastRun: "Mar 18, 2026", sopId: "sop-001" },
  { id: "RACM-002", bpId: "p2p", name: "FY26 P2P · Purchase Order", fw: "Internal", status: "draft", owner: "Deepak Bansal", lastRun: "Mar 5, 2026", sopId: "sop-002" },
  { id: "RACM-003", bpId: "o2c", name: "FY26 O2C · Invoice Mgmt", fw: "Key Control", status: "active", owner: "Neha Joshi", lastRun: "Mar 20, 2026", sopId: "sop-003" },
  { id: "RACM-004", bpId: "r2r", name: "FY26 R2R · Financial Close", fw: "SOX", status: "active", owner: "Karan Mehta", lastRun: "Mar 15, 2026", sopId: "sop-004" },
  { id: "RACM-005", bpId: "r2r", name: "FY26 R2R · GL Reconciliation", fw: "ITGC", status: "active", owner: "Sneha Desai", lastRun: "Feb 28, 2026", sopId: "sop-005" },
  // S2C is the "from scratch" demo process — no seed RACM/risks/SOP so its tabs show empty states.
  { id: "RACM-007", bpId: "o2c", name: "FY26 O2C · Order to Cash", fw: "SOX", status: "active", owner: "Neha Joshi", lastRun: "Mar 21, 2026", sopId: "sop-003" },
  // RACMs generated from the P2P SOP-list "RACM Ready" SOPs — each shares its SOP's name.
  { id: "RACM-102", bpId: "p2p", name: "Sample SOP", fw: "SOX", status: "active", owner: "Kuldeep Pandey", lastRun: "May 6, 2026", sopId: "sop-102" },
  { id: "RACM-104", bpId: "p2p", name: "Testing RACM (4)_RACM", fw: "SOX", status: "active", owner: "Superadmin", lastRun: "May 6, 2026", sopId: "sop-104" },
  { id: "RACM-105", bpId: "p2p", name: "Agrawal Metals - Part 1 - Fixed Assets - SOP", fw: "SOX", status: "active", owner: "Kuldeep Pandey", lastRun: "May 11, 2026", sopId: "sop-105" },
];

// ─── Risks ───
export const RISKS = [
  { id: "RSK-001", name: "Unauthorized vendor payments processed without approval", ctls: 3, keyCtls: 1, lastUpdated: "Mar 18, 2026", severity: "high", bpId: "p2p", status: "open" },
  { id: "RSK-002", name: "Duplicate invoices leading to overpayment", ctls: 4, keyCtls: 2, lastUpdated: "Mar 15, 2026", severity: "high", bpId: "p2p", status: "mitigated" },
  { id: "RSK-003", name: "Vendor master data manipulation by unauthorized users", ctls: 2, keyCtls: 1, lastUpdated: "Mar 10, 2026", severity: "medium", bpId: "p2p", status: "open" },
  { id: "RSK-004", name: "Fictitious vendor registration bypassing approval", ctls: 0, keyCtls: 0, lastUpdated: null, severity: "critical", bpId: "p2p", status: "open" },
  { id: "RSK-005", name: "Unauthorized changes to payment terms", ctls: 1, keyCtls: 0, lastUpdated: "Feb 20, 2026", severity: "medium", bpId: "p2p", status: "mitigated" },
  { id: "RSK-006", name: "Overdue customer receivables not escalated for collection", ctls: 4, keyCtls: 1, lastUpdated: "Feb 15, 2026", severity: "medium", bpId: "o2c", status: "mitigated" },
  { id: "RSK-008", name: "Segregation of duties violation in Accounts Payable", ctls: 3, keyCtls: 1, lastUpdated: "Jan 30, 2026", severity: "critical", bpId: "p2p", status: "open" },
  { id: "RSK-010", name: "Revenue recognition timing manipulation", ctls: 4, keyCtls: 2, lastUpdated: "Mar 19, 2026", severity: "high", bpId: "o2c", status: "open" },
  { id: "RSK-011", name: "Incorrect period-end journal entries", ctls: 3, keyCtls: 2, lastUpdated: "Mar 17, 2026", severity: "medium", bpId: "r2r", status: "mitigated" },
  { id: "RSK-012", name: "GL balance discrepancy across subsidiaries", ctls: 2, keyCtls: 1, lastUpdated: "Feb 28, 2026", severity: "high", bpId: "r2r", status: "open" },
  // O2C — Order to Cash risks (orders, credit, shipping, billing, cash application, collections)
  { id: "RSK-013", name: "Sales orders processed beyond approved customer credit limit", ctls: 5, keyCtls: 2, lastUpdated: "Mar 21, 2026", severity: "high", bpId: "o2c", status: "open" },
  { id: "RSK-014", name: "Goods shipped without a confirmed and approved customer order", ctls: 5, keyCtls: 2, lastUpdated: "Mar 16, 2026", severity: "medium", bpId: "o2c", status: "mitigated" },
  { id: "RSK-015", name: "Customer invoices not raised for goods shipped", ctls: 0, keyCtls: 0, lastUpdated: null, severity: "high", bpId: "o2c", status: "open" },
  { id: "RSK-016", name: "Cash receipts misapplied to incorrect customer accounts", ctls: 0, keyCtls: 0, lastUpdated: null, severity: "medium", bpId: "o2c", status: "open" },
  { id: "RSK-017", name: "Sales returns and credit notes issued without authorization", ctls: 0, keyCtls: 0, lastUpdated: null, severity: "critical", bpId: "o2c", status: "open" },
];

// ─── Controls ───
export const CONTROLS = [
  { id: "CTR-001", name: "Three-way PO/GRN/Invoice matching", desc: "System-enforced matching before payment release", isKey: true, riskId: "RSK-001", status: "effective" },
  { id: "CTR-002", name: "Dual approval for payments above threshold", desc: "Two-level manager approval for payments > 10L", isKey: true, riskId: "RSK-001", status: "effective" },
  { id: "CTR-003", name: "Vendor master change notification", desc: "Email alerts to finance head on any vendor master update", isKey: false, riskId: "RSK-003", status: "effective" },
  { id: "CTR-004", name: "Privileged Access Review", desc: "Quarterly review of all AP module access rights", isKey: false, riskId: "RSK-008", status: "ineffective" },
  { id: "CTR-005", name: "Duplicate invoice detection workflow", desc: "Automated duplicate detection before payment processing", isKey: true, riskId: "RSK-002", status: "effective" },
  { id: "CTR-006", name: "SOD violation detector real-time", desc: "Real-time segregation of duties conflict checker", isKey: false, riskId: "RSK-008", status: "not-tested" },
  { id: "CTR-007", name: "Revenue recognition compliance check", desc: "Automated check against ASC 606 criteria", isKey: true, riskId: "RSK-010", status: "effective" },
  { id: "CTR-008", name: "Journal entry anomaly detector", desc: "AI-powered anomaly detection on journal entries", isKey: true, riskId: "RSK-011", status: "effective" },
  // ── O2C — Order to Cash controls ──
  // RSK-010 · Revenue recognition timing manipulation (4 controls; CTR-007 above is the 1st)
  { id: "CTR-009", name: "Period-end cut-off review for revenue", desc: "Manual review of shipments and invoices around period close to confirm correct revenue period", isKey: true, riskId: "RSK-010", status: "effective" },
  { id: "CTR-010", name: "Deferred revenue schedule reconciliation", desc: "Monthly reconciliation of deferred revenue balances to contract milestones", isKey: false, riskId: "RSK-010", status: "effective" },
  { id: "CTR-011", name: "Multi-element arrangement allocation review", desc: "Review of revenue allocation across bundled performance obligations", isKey: false, riskId: "RSK-010", status: "not-tested" },
  // RSK-006 · Overdue customer receivables not escalated for collection (4 controls)
  { id: "CTR-012", name: "AR ageing review and dunning", desc: "Weekly review of the AR ageing report with automated dunning notices to overdue customers", isKey: true, riskId: "RSK-006", status: "effective" },
  { id: "CTR-013", name: "Collections escalation workflow", desc: "Overdue balances past threshold auto-escalated to the collections manager", isKey: false, riskId: "RSK-006", status: "effective" },
  { id: "CTR-014", name: "Bad-debt provision review", desc: "Quarterly review of allowance for doubtful accounts against ageing buckets", isKey: false, riskId: "RSK-006", status: "effective" },
  { id: "CTR-015", name: "Customer statement reconciliation", desc: "Monthly customer statements reconciled to the AR sub-ledger", isKey: false, riskId: "RSK-006", status: "not-tested" },
  // RSK-013 · Sales orders processed beyond approved customer credit limit (5 controls)
  { id: "CTR-016", name: "Automated credit limit check on order entry", desc: "System blocks sales orders that exceed the customer's approved credit limit", isKey: true, riskId: "RSK-013", status: "effective" },
  { id: "CTR-017", name: "Credit hold release approval", desc: "Orders on credit hold require credit-manager approval before release", isKey: true, riskId: "RSK-013", status: "effective" },
  { id: "CTR-018", name: "Periodic credit limit reassessment", desc: "Customer credit limits reviewed annually against payment history and credit rating", isKey: false, riskId: "RSK-013", status: "effective" },
  { id: "CTR-019", name: "New customer credit approval", desc: "Credit checks and approval required before onboarding a new credit customer", isKey: false, riskId: "RSK-013", status: "effective" },
  { id: "CTR-020", name: "Credit exposure exception report", desc: "Daily report of orders released over limit reviewed by finance", isKey: false, riskId: "RSK-013", status: "ineffective" },
  // RSK-014 · Goods shipped without a confirmed and approved customer order (5 controls)
  { id: "CTR-021", name: "Order-to-shipment matching", desc: "Warehouse releases stock only against an approved sales order in the system", isKey: true, riskId: "RSK-014", status: "effective" },
  { id: "CTR-022", name: "Pick-list to delivery-note reconciliation", desc: "Quantities picked reconciled to the delivery note before despatch", isKey: true, riskId: "RSK-014", status: "effective" },
  { id: "CTR-023", name: "Shipping authorization sign-off", desc: "Despatch supervisor signs off each shipment against the approved order", isKey: false, riskId: "RSK-014", status: "effective" },
  { id: "CTR-024", name: "Goods-in-transit reconciliation", desc: "Daily reconciliation of goods despatched to goods invoiced", isKey: false, riskId: "RSK-014", status: "effective" },
  { id: "CTR-025", name: "Unmatched shipment exception review", desc: "Shipments without a matching approved order flagged for review", isKey: false, riskId: "RSK-014", status: "not-tested" },
];

// ─── Engagements ───
export const ENGAGEMENTS = [
  { id: "eng-001", name: "FY26 SOX Audit", type: "SOX", status: "active", bps: ["p2p", "o2c", "r2r"], owner: "Karan Mehta", start: "Jan 1, 2026", end: "Mar 31, 2026", controls: 24, tested: 14, effective: 11, deficiencies: 2 },
  { id: "eng-002", name: "FY26 IFC Assessment", type: "IFC", status: "draft", bps: ["p2p", "s2c"], owner: "Sneha Desai", start: "Apr 1, 2026", end: "Jun 30, 2026", controls: 18, tested: 0, effective: 0, deficiencies: 0 },
  { id: "eng-003", name: "FY25 SOX Audit", type: "SOX", status: "complete", bps: ["p2p", "o2c", "s2c", "r2r"], owner: "Abhinav S", start: "Jan 1, 2025", end: "Mar 31, 2025", controls: 38, tested: 38, effective: 34, deficiencies: 4 },
];

// ─── Engagement Controls (Audit Execution) ───
export const ENGAGEMENT_CONTROLS = [
  { id: "ec-001", engId: "eng-001", racm: "P2P Vendor Payment", risk: "Unauthorized vendor payments", control: "Three-way PO/GRN/Invoice matching", isKey: true, assignee: "Tushar Goel", wt: "effective", de: "effective", oe: "in-progress", evidence: 3 },
  { id: "ec-002", engId: "eng-001", racm: "P2P Vendor Payment", risk: "Duplicate payments", control: "Duplicate invoice detection workflow", isKey: true, assignee: "Deepak Bansal", wt: "effective", de: "effective", oe: "effective", evidence: 5 },
  { id: "ec-003", engId: "eng-001", racm: "P2P Purchase Order", risk: "Unauthorized PO creation", control: "PO dual sign-off approval workflow", isKey: false, assignee: "Neha Joshi", wt: "effective", de: "effective", oe: "not-started", evidence: 0 },
  { id: "ec-004", engId: "eng-001", racm: "O2C Invoice Mgmt", risk: "Revenue recognition timing", control: "Revenue recognition compliance check", isKey: true, assignee: "Karan Mehta", wt: "in-progress", de: "not-started", oe: "not-started", evidence: 1 },
  { id: "ec-005", engId: "eng-001", racm: "O2C Invoice Mgmt", risk: "Credit limit breach", control: "Automated credit limit monitoring", isKey: false, assignee: "Sneha Desai", wt: "effective", de: "ineffective", oe: "not-started", evidence: 2 },
  { id: "ec-006", engId: "eng-001", racm: "R2R Financial Close", risk: "Incorrect period-end entries", control: "Journal entry management review", isKey: true, assignee: "Rohan Patel", wt: "effective", de: "effective", oe: "effective", evidence: 4 },
  { id: "ec-007", engId: "eng-001", racm: "R2R Financial Close", risk: "GL balance discrepancy", control: "GL reconciliation, monthly auto", isKey: true, assignee: "Priya Singh", wt: "effective", de: "effective", oe: "in-progress", evidence: 2 },
  { id: "ec-008", engId: "eng-001", racm: "P2P Vendor Payment", risk: "SOD violation in AP", control: "SOD violation detector real-time", isKey: false, assignee: "Tushar Goel", wt: "not-started", de: "not-started", oe: "not-started", evidence: 0 },
];

// ─── Deficiencies ───
export const DEFICIENCIES = [
  { id: "def-001", finding: "Automated credit limit monitoring failed for 3 high-value customers in Q4 FY26", severity: "SD", control: "Automated credit limit monitoring", assignee: "Sneha Desai", status: "open", due: "Apr 15, 2026" },
  { id: "def-002", finding: "Journal entry approval override used 7 times without adequate documentation during Dec 2025", severity: "MW", control: "Journal entry management review", assignee: "Rohan Patel", status: "in-progress", due: "Mar 31, 2026" },
  { id: "def-003", finding: "SOD violation identified between AP entry and payment approval roles for 2 users", severity: "CD", control: "SOD violation detector real-time", assignee: "Karan Mehta", status: "resolved", due: "Feb 28, 2026" },
];

// ─── Workflows (Pre-built) ───
export const WORKFLOWS = [
  { id: "wf-001", name: "Duplicate Invoice Detector", desc: "Scans incoming invoices against historical data to flag potential duplicates before payment processing", bpId: "p2p", type: "Detection", lastRun: "Mar 18, 2026", runs: 12, status: "active", steps: ["Ingest invoice data", "Normalize fields", "Fuzzy match against history", "Score duplicates", "Flag & notify AP team"] },
  { id: "wf-002", name: "Vendor Master Change Monitor", desc: "Monitors all changes to vendor master data and alerts compliance team of unauthorized modifications", bpId: "p2p", type: "Monitoring", lastRun: "Mar 20, 2026", runs: 8, status: "active", steps: ["Listen to change events", "Classify change type", "Check authorization", "Generate alert", "Log audit trail"] },
  { id: "wf-003", name: "High-Value Payment Flagging", desc: "Automatically flags payments exceeding threshold amounts for additional review", bpId: "p2p", type: "Detection", lastRun: "Mar 12, 2026", runs: 6, status: "active", steps: ["Monitor payment queue", "Apply threshold rules", "Enrich with vendor data", "Route for approval", "Release or hold"] },
  { id: "wf-004", name: "Revenue Recognition Checker", desc: "Validates revenue recognition against ASC 606 criteria for compliance", bpId: "o2c", type: "Compliance", lastRun: "Mar 19, 2026", runs: 4, status: "active", steps: ["Extract revenue entries", "Map to ASC 606 criteria", "Validate timing", "Check completeness", "Generate compliance report"] },
  { id: "wf-005", name: "Journal Entry Anomaly Detector", desc: "Uses AI/ML to detect unusual journal entry patterns that may indicate fraud or errors", bpId: "r2r", type: "Detection", lastRun: "Mar 17, 2026", runs: 22, status: "active", steps: ["Collect journal entries", "Feature extraction", "Run anomaly model", "Score entries", "Alert reviewers"] },
  { id: "wf-006", name: "Contract Expiry Alert", desc: "Tracks contract expiration dates and sends proactive alerts to stakeholders", bpId: "s2c", type: "Monitoring", lastRun: "Mar 5, 2026", runs: 3, status: "active", steps: ["Scan contract database", "Calculate days to expiry", "Apply alert rules", "Notify stakeholders", "Log actions"] },
  { id: "wf-007", name: "Three-Way PO Match", desc: "Automated matching of Purchase Order, Goods Receipt Note, and Invoice for payment validation", bpId: "p2p", type: "Reconciliation", lastRun: "Mar 15, 2026", runs: 45, status: "active", steps: ["Fetch PO details", "Match GRN", "Match Invoice", "Validate tolerances", "Auto-approve or escalate"] },
  { id: "wf-008", name: "SOD Violation Detector", desc: "Real-time segregation of duties conflict detection across all business processes", bpId: "p2p", type: "Compliance", lastRun: "Mar 1, 2026", runs: 15, status: "active", steps: ["Load role matrix", "Map user permissions", "Detect conflicts", "Assess risk level", "Generate violation report"] },
  // ── O2C — Order to Cash workflows ──
  { id: "wf-009", name: "Credit Limit Monitor", desc: "Continuously checks open sales orders against approved customer credit limits and holds orders that breach the limit", bpId: "o2c", type: "Monitoring", lastRun: "Mar 21, 2026", runs: 19, status: "active", steps: ["Fetch open orders", "Pull customer credit limit", "Compute exposure", "Flag breaches", "Place order on credit hold"] },
  { id: "wf-010", name: "Cash Application Matcher", desc: "Auto-matches incoming customer remittances to open invoices and routes unmatched receipts for review", bpId: "o2c", type: "Reconciliation", lastRun: "Mar 20, 2026", runs: 33, status: "active", steps: ["Ingest bank remittances", "Parse remittance advice", "Match to open invoices", "Apply cash", "Queue unmatched for review"] },
];

// ─── Report Templates ───
export const REPORT_TEMPLATES = [
  { id: "rt-internal-audit", name: "Internal Audit Report", desc: "End-to-end audit report with executive summary, audit queries, findings, and recommendations", category: "Audit", icon: "file-text", sections: [
    { name: 'Executive Summary', icon: 'file-text' },
    { name: 'Audit Queries', icon: 'check-circle' },
    { name: 'Recommendations', icon: 'trending-up' },
    { name: 'Appendix', icon: 'file-text' },
  ]},
  { id: "rt-001", name: "SOX Compliance Report", desc: "Comprehensive SOX compliance status with control testing results", category: "Compliance", icon: "shield", sections: [
    { name: 'Executive Summary', icon: 'file-text' },
    { name: 'Scope & Objectives', icon: 'file-text' },
    { name: 'Testing Methodology', icon: 'file-text' },
    { name: 'Control Testing Results', icon: 'check-circle' },
    { name: 'Detailed Description', icon: 'alert-triangle' },
    { name: 'Appendix', icon: 'file-text' },
  ]},
  { id: "rt-007", name: "ATR Report", desc: "Action Taken Report with query-wise summary, closure status, key insights, auditor comments, and sign-off", category: "Audit", icon: "clipboard-check", sections: [
    { name: 'Report Information', icon: 'file-text' },
    { name: 'Query-wise Summary', icon: 'check-circle' },
    { name: 'Summary of Closure Status', icon: 'bar-chart' },
    { name: 'Key Insights & Recommendations', icon: 'lightbulb' },
    { name: 'Auditor Comments', icon: 'book-open' },
    { name: 'Approvals & Sign-Off', icon: 'shield' },
  ]},
  // { id: "rt-002", name: "Risk Assessment Summary", desc: "Overview of all identified risks, their ratings, and mitigation status", category: "Risk", icon: "alert-triangle", sections: [
  //   { name: 'Executive Summary', icon: 'file-text' },
  //   { name: 'Risk Identification', icon: 'alert-triangle' },
  //   { name: 'Risk Matrix', icon: 'shield' },
  //   { name: 'Mitigation Strategies', icon: 'check-circle' },
  //   { name: 'Trend Analysis', icon: 'trending-up' },
  //   { name: 'Recommendations', icon: 'file-text' },
  // ]},
  // { id: "rt-003", name: "Control Effectiveness Report", desc: "Detailed analysis of control effectiveness across all business processes", category: "Controls", icon: "check-circle", sections: [
  //   { name: 'Executive Summary', icon: 'file-text' },
  //   { name: 'Control Environment Overview', icon: 'shield' },
  //   { name: 'Testing Methodology', icon: 'file-text' },
  //   { name: 'Effectiveness Ratings', icon: 'check-circle' },
  //   { name: 'Gap Analysis', icon: 'alert-triangle' },
  //   { name: 'Improvement Plan', icon: 'trending-up' },
  // ]},
  // { id: "rt-004", name: "Workflow Analytics Report", desc: "Performance metrics and insights from automated workflow executions", category: "Analytics", icon: "bar-chart", sections: [
  //   { name: 'Executive Summary', icon: 'file-text' },
  //   { name: 'Workflow Performance Metrics', icon: 'bar-chart' },
  //   { name: 'Exception Trends', icon: 'trending-up' },
  //   { name: 'Processing Efficiency', icon: 'check-circle' },
  //   { name: 'Anomaly Detection Results', icon: 'alert-triangle' },
  //   { name: 'Recommendations', icon: 'file-text' },
  // ]},
  // { id: "rt-005", name: "Deficiency Tracker", desc: "Status of all identified deficiencies with remediation progress", category: "Audit", icon: "file-text", sections: [
  //   { name: 'Executive Summary', icon: 'file-text' },
  //   { name: 'Key Findings', icon: 'alert-triangle' },
  //   { name: 'Deficiency Details', icon: 'shield' },
  //   { name: 'Remediation Progress', icon: 'check-circle' },
  //   { name: 'Timeline & Milestones', icon: 'trending-up' },
  //   { name: 'Appendix', icon: 'file-text' },
  // ]},
  // { id: "rt-006", name: "Executive Dashboard Export", desc: "Board-ready summary of GRC posture and key metrics", category: "Executive", icon: "trending-up", sections: [
  //   { name: 'Executive Summary', icon: 'file-text' },
  //   { name: 'Key Metrics Dashboard', icon: 'bar-chart' },
  //   { name: 'Risk Heatmap', icon: 'alert-triangle' },
  //   { name: 'Compliance Scorecard', icon: 'shield' },
  //   { name: 'Strategic Recommendations', icon: 'check-circle' },
  //   { name: 'Outlook & Next Steps', icon: 'trending-up' },
  // ]},
];

// ─── Generated Reports ───
// Mock workflow results seeded onto the demo Bulk Audit report (gr-002) so
// the report opens with workflow cards, severity chips, and an output table
// even without running a fresh Bulk Run from Workflow Library.
export const SEED_BULK_AUDIT_WORKFLOWS: WorkflowResult[] = [
  {
    id: 'wfr-seed-1',
    workflowId: 'WF-001',
    name: '3-Way Match (PO · GRN · Invoice)',
    businessProcess: 'P2P',
    severity: 'High' as const,
    findings: [
      'Detected 18 invoices without matching POs in the analysis window.',
      '6 invoices breached the 5% price-variance threshold and require AP review.',
    ],
    observations: [
      'Coverage was complete across the supplied PO/GRN/Invoice files; no schema gaps.',
      'Top contributors concentrated in the last fortnight of the period.',
    ],
    outputTable: {
      columns: ['Record ID', 'Vendor', 'Flag', 'Amount', 'Date'],
      rows: [
        ['WF-001-001', 'Vendor A-1', 'High',   '₹2,40,000', '04 Mar'],
        ['WF-001-002', 'Vendor B-2', 'High',   '₹1,15,500', '07 Mar'],
        ['WF-001-003', 'Vendor C-3', 'Medium', '₹84,200',   '11 Mar'],
        ['WF-001-004', 'Vendor D-4', 'High',   '₹1,92,750', '15 Mar'],
        ['WF-001-005', 'Vendor E-5', 'Medium', '₹47,300',   '18 Mar'],
      ],
    },
  },
  {
    id: 'wfr-seed-2',
    workflowId: 'WF-002',
    name: 'Invoice Duplicate Detection',
    businessProcess: 'P2P',
    severity: 'Medium' as const,
    findings: [
      '12 candidate duplicate invoices identified across 4 vendors.',
      '3 of the candidates share GSTIN, invoice number, and amount.',
    ],
    observations: [
      'Vendor master GSTIN coverage at 96% — gaps mostly in non-active vendors.',
      'Duplicate concentration on the first week of the period.',
    ],
    outputTable: {
      columns: ['Record ID', 'Vendor', 'Flag', 'Amount', 'Date'],
      rows: [
        ['WF-002-001', 'Vendor F-1', 'Medium', '₹62,000',  '02 Mar'],
        ['WF-002-002', 'Vendor G-2', 'High',   '₹1,28,400','04 Mar'],
        ['WF-002-003', 'Vendor H-3', 'Low',    '₹19,800',  '08 Mar'],
        ['WF-002-004', 'Vendor I-4', 'Medium', '₹91,500',  '12 Mar'],
      ],
    },
  },
  {
    id: 'wfr-seed-3',
    workflowId: 'WF-003',
    name: 'Payment Block Review',
    businessProcess: 'P2P',
    severity: 'Low' as const,
    findings: [
      '4 vendors had payment blocks lifted within 24 hours of invoice posting.',
      'No bank-account mismatches were detected against vendor master.',
    ],
    observations: [
      'IFSC mapping was clean across the file; vendor bank account confidence high.',
    ],
    outputTable: {
      columns: ['Record ID', 'Vendor', 'Flag', 'Amount', 'Date'],
      rows: [
        ['WF-003-001', 'Vendor J-1', 'Low', '₹14,200', '03 Mar'],
        ['WF-003-002', 'Vendor K-2', 'Low', '₹22,750', '09 Mar'],
        ['WF-003-003', 'Vendor L-3', 'Low', '₹8,900',  '14 Mar'],
      ],
    },
  },
  // Failed runs — excluded from the report body, only surfaced via the
  // "failed runs" callout in the Executive Summary.
  {
    id: 'wfr-seed-4',
    workflowId: 'WF-004',
    name: 'Vendor Bank Account Anomaly',
    businessProcess: 'P2P',
    severity: 'Low' as const,
    findings: [],
    observations: [],
    runStatus: 'failed' as const,
    failureReason: 'errored' as const,
  },
  {
    id: 'wfr-seed-5',
    workflowId: 'WF-005',
    name: 'GRN Quantity Reconciliation',
    businessProcess: 'P2P',
    severity: 'Low' as const,
    findings: [],
    observations: [],
    runStatus: 'failed' as const,
    failureReason: 'skipped' as const,
  },
];

/** Single source of truth for the persisted-reports localStorage key. Bump the
 *  version suffix to invalidate stale blobs (e.g. after a seed-shape change).
 *  All writers (ReportsView, App, BulkRunProgress) must use this constant so
 *  the key can never drift between them. */
export const GENERATED_REPORTS_KEY = 'irame.reports.generatedReports.v9';

export const GENERATED_REPORTS = [
  { id: "gr-001", templateId: "rt-001", name: "FY26 Q1 Financial Reporting Controls Review", tag: "Internal Audit", generatedBy: "You", generatedAt: "Mar 20, 2026", status: "final", pages: 24, queries: 6 },
  { id: "gr-002", templateId: "ct-custom-01", name: "P2P Risk Assessment — March 2026", tag: "Bulk Audit", generatedBy: "You", generatedAt: "Mar 18, 2026", status: "draft", pages: 12, queries: 4, workflowResults: SEED_BULK_AUDIT_WORKFLOWS },
  { id: "gr-003", templateId: "ct-custom-02", name: "Workflow Performance Review — Feb 2026", tag: "Internal Audit", generatedBy: "You", generatedAt: "Mar 1, 2026", status: "final", pages: 8, queries: 3 },
  { id: "gr-004", templateId: "rt-001", name: "FY26 Q1 Comprehensive Multi-Jurisdictional Procure-to-Pay and Order-to-Cash Risk Assessment with Detailed Vendor Master Anomaly Detection, Duplicate Invoice Forensics, Segregation of Duties Audit, and Quarter-End Reconciliation Variance Review Report", tag: "Internal Audit", generatedBy: "You", generatedAt: "Feb 24, 2026", status: "draft", pages: 41, queries: 12 },
  { id: "gr-005", templateId: "rt-001", name: "Quarter-End Reconciliation Variance Review — Q1 FY26", tag: "Internal Audit", generatedBy: "You", generatedAt: "Mar 16, 2026", status: "final", pages: 16, queries: 5 },
  { id: "gr-006", templateId: "rt-001", name: "Segregation of Duties Assessment — Finance", tag: "Internal Audit", generatedBy: "You", generatedAt: "Mar 12, 2026", status: "draft", pages: 11, queries: 4 },
  { id: "gr-007", templateId: "rt-001", name: "IT General Controls Effectiveness — FY26", tag: "Internal Audit", generatedBy: "You", generatedAt: "Mar 8, 2026", status: "final", pages: 19, queries: 7 },
  { id: "gr-008", templateId: "rt-internal-audit", name: "Procure-to-Pay Process Audit — March 2026", tag: "Internal Audit", generatedBy: "You", generatedAt: "Mar 5, 2026", status: "final", pages: 14, queries: 5 },
  { id: "gr-009", templateId: "rt-internal-audit", name: "Vendor Master Data Integrity Assessment", tag: "Internal Audit", generatedBy: "You", generatedAt: "Feb 28, 2026", status: "draft", pages: 9, queries: 3 },
  { id: "gr-010", templateId: "rt-internal-audit", name: "Order-to-Cash Revenue Audit — Q1 FY26", tag: "Internal Audit", generatedBy: "You", generatedAt: "Feb 20, 2026", status: "final", pages: 22, queries: 8 },
];

export const SHARED_REPORTS = [
  { id: "sr-001", name: "FY26 Internal Audit Summary", kind: "ia", sharedBy: "Neha Joshi", sharedAt: "Apr 10, 2026", status: "final", pages: 18, sharedWith: "Audit Team", queries: 5 },
  { id: "sr-002", name: "O2C Controls Review — Q1 2026", kind: "sox", sharedBy: "Deepak Bansal", sharedAt: "Apr 5, 2026", status: "final", pages: 14, sharedWith: "Finance", queries: 4 },
  { id: "sr-003", name: "Vendor Risk Exposure Report", kind: "ia", sharedBy: "Karan Mehta", sharedAt: "Mar 28, 2026", status: "draft", pages: 9, sharedWith: "Risk Committee", queries: 2 },
  { id: "sr-004", name: "GL Reconciliation — Feb 2026", kind: "sox", sharedBy: "Sneha Desai", sharedAt: "Mar 15, 2026", status: "final", pages: 22, sharedWith: "CFO Office", queries: 7 },
];

// ─── Data Sources ───
export const DATA_SOURCES = [
  { id: "ds-001", name: "SAP ERP: AP Module", type: "sql", status: "connected", lastSync: "Mar 20, 2026", records: "1.2M" },
  { id: "ds-002", name: "Invoice Archive 2026", type: "pdf", status: "connected", lastSync: "Mar 19, 2026", records: "4,521" },
  { id: "ds-003", name: "Vendor Master Data", type: "csv", status: "connected", lastSync: "Mar 20, 2026", records: "892" },
  { id: "ds-004", name: "GL Transaction History", type: "sql", status: "connected", lastSync: "Mar 18, 2026", records: "3.8M" },
  { id: "ds-005", name: "Contract Repository", type: "pdf", status: "disconnected", lastSync: "Feb 15, 2026", records: "234" },
];

// ─── Chat History ───
export const CHAT_HISTORY = [
  { id: "ch-001", title: "P2P Risk Analysis", preview: "Show me all high-severity risks in P2P...", timestamp: "Mar 20, 2026", messages: 8 },
  { id: "ch-002", title: "Duplicate Invoice Workflow", preview: "Build a workflow to detect duplicate invoices...", timestamp: "Mar 19, 2026", messages: 12 },
  { id: "ch-003", title: "SOX Compliance Status", preview: "What's the current SOX compliance status...", timestamp: "Mar 18, 2026", messages: 5 },
  { id: "ch-004", title: "Control Effectiveness Query", preview: "Which controls are marked ineffective...", timestamp: "Mar 17, 2026", messages: 6 },
  { id: "ch-005", title: "Journal Entry Anomalies", preview: "Run the journal entry anomaly detector...", timestamp: "Mar 15, 2026", messages: 15 },
];

// ─── Pre-built Chat Conversations ───
export const CHAT_CONVERSATIONS: Record<string, Array<{ role: 'user' | 'assistant'; text: string }>> = {
  'ch-001': [
    { role: 'user', text: 'Show me all high-severity risks in P2P process' },
    { role: 'assistant', text: '**P2P High-Severity Risks Found: 3**\n\nI\'ve analyzed your P2P risk register and identified 3 high-severity risks:\n\n• **RSK-001**: Unauthorized vendor payments processed without approval (3 controls mapped)\n• **RSK-002**: Duplicate invoices leading to overpayment (4 controls, 2 key)\n• **RSK-008**: Segregation of duties violation in AP (3 controls, 1 key)\n\nRSK-008 is the most concerning; the SOD violation detector control (CTR-006) remains untested.' },
    { role: 'user', text: 'What controls cover RSK-008?' },
    { role: 'assistant', text: '**Controls for RSK-008 (SOD Violation):**\n\n1. **CTR-004**: Privileged Access Review (quarterly) → Status: **Ineffective** ⚠️\n2. **CTR-006**: SOD Violation Detector Real-time → Status: **Not Tested**\n3. **CTR-002**: Dual Approval for Payments > 10L → Status: **Effective** ✓\n\n**Recommendation:** Prioritize testing CTR-006 and remediating CTR-004. The privileged access review failed because scope was limited to AP module only. Expand to include all financial modules.' },
  ],
  'ch-002': [
    { role: 'user', text: 'Build a workflow to detect duplicate invoices across all vendors' },
    { role: 'assistant', text: 'I\'ll build a Duplicate Invoice Detector workflow. Let me configure the steps based on your requirements.\n\n**Workflow: Duplicate Invoice Detector v4**\n\n📊 Connected to: SAP ERP AP Module (1.2M records)\n🔍 Detection: Fuzzy match with 5% tolerance\n⚡ Processing: AI-powered pattern detection\n\nThe workflow is ready and saved to your library with 5 execution steps.' },
  ],
  'ch-003': [
    { role: 'user', text: 'What\'s the current SOX compliance status?' },
    { role: 'assistant', text: '**FY26 SOX Audit: Status Overview**\n\n📊 **Overall Progress: 58%** (14 of 24 controls tested)\n\n• **Effective:** 11 controls (79%)\n• **Ineffective:** 1 control (CTR-004, Privileged Access Review)\n• **Not Tested:** 10 controls remaining\n• **Deficiencies Found:** 2 (1 Significant Deficiency, 1 Material Weakness)\n\n⚠️ **Critical Items:**\n- DEF-002 (Material Weakness): Journal entry approval override used 7 times without documentation. Due Mar 31.\n- 10 controls still pending testing before quarter-end\n\n**Recommendation:** Focus testing resources on remaining P2P and S2C controls. The Mar 31 deadline for DEF-002 remediation is at risk.' },
  ],
  'ch-004': [
    { role: 'user', text: 'Which controls are marked ineffective?' },
    { role: 'assistant', text: '**Ineffective Controls Report**\n\n1 control is currently marked ineffective:\n\n🔴 **CTR-004: Privileged Access Review**\n- Risk: RSK-008 (SOD Violation in AP)\n- Engagement: FY26 SOX Audit\n- Assignee: Tushar Goel\n- Issue: Quarterly review scope limited to AP module; did not cover AR and GL modules\n- Deficiency: DEF-003 (Control Deficiency), resolved Feb 28, 2026\n\n**Additionally, 2 controls are Not Tested:**\n- CTR-006: SOD Violation Detector (assigned to Tushar Goel)\n- 1 control in O2C process (PO dual sign-off pending)\n\n**Action:** Schedule CTR-006 testing this week to maintain SOX timeline.' },
  ],
  'ch-005': [
    { role: 'user', text: 'Run the journal entry anomaly detector and show me the results' },
    { role: 'assistant', text: '**Journal Entry Anomaly Detector: Results**\n\nScanned 3.8M GL transactions from R2R process.\n\n📊 **Summary:**\n- Records Analyzed: 3,847,231\n- Anomalies Detected: 23\n- Critical Anomalies: 3\n- Processing Time: 1.8s\n\n🔴 **Critical Findings:**\n1. 7 journal entries with approval overrides in Dec 2025 (linked to DEF-002)\n2. Unusual round-number entries totaling ₹4.2Cr posted at month-end\n3. 2 entries posted by user with revoked access (access not properly terminated)\n\n**Impact Score: 88/100**\nThis is a high-impact finding. Recommend immediate review of the 3 critical anomalies and escalation to the audit committee.' },
  ],
  // ── Synthesised recents conversations ──
  // Back the padded Recents → Chats rows (ch-syn-0..8, generated by
  // RecentsView.buildChatRows) so each row opens a real thread instead of a
  // blank chat. Keys + titles mirror RecentsView; content fits each literal
  // title (these are general working chats, not all audit queries).
  'ch-syn-0': [
    { role: 'user', text: 'Help me brainstorm the vision for our auditor-journey hackathon demo. I want a story that lands.' },
    { role: 'assistant', text: '**Auditor Journey Hackathon — Vision** 🚀\n\nFrame it as *"a day in the life, minus the busywork."* Follow one auditor from messy intake to signed-off opinion.\n\n**Narrative arc:**\n• **Before** — buried in PDFs, scattered emails, manual sampling\n• **With Ira** — evidence auto-mapped to controls, gaps surfaced instantly\n• **After** — audit closed in hours, not weeks\n\n**Three pillars to anchor the demo:**\n• **Ingest** — drop any doc, Ira extracts the RACM\n• **Reason** — risk scoring + control testing on the fly\n• **Report** — one-click findings memo\n\nClose on the emotional beat: *the auditor goes home on time.* Want me to draft the opening line for the pitch?' },
  ],
  'ch-syn-1': [
    { role: 'user', text: 'We\'re rethinking the audit platform\'s architecture. The monolith is getting hard to scale — can you sketch a redesign covering modules, data flow, and scalability?' },
    { role: 'assistant', text: '**Audit Platform Architecture Redesign** 🏗️\n\nHere\'s a modular breakdown I\'d recommend:\n\n**Core modules (decoupled services):**\n• **Ingestion** — connectors for GL, ERP, SAP; normalize into a canonical event schema\n• **Risk & Controls** — RACM engine, control testing, scoring\n• **Analytics** — anomaly detection, sampling, trend models\n• **Evidence & Workpapers** — immutable store + audit trail\n• **Reporting** — dashboards, findings, exports\n\n**Data flow:**\nSource systems → ingestion queue → canonical store → analytics workers → results cache → API/UI. Keep raw and derived layers separate so re-runs never mutate source data.\n\n⚡ **Scalability moves:**\n• Split read/write paths — heavy analytics on a replica, not the live OLTP DB\n• Event-driven workers (queue-backed) so spikes in JE volume scale horizontally\n• Multi-tenant isolation at the data layer (row-level + per-tenant keys)\n• Cache RACM lookups; they\'re read-hot and rarely change\n\nWant me to turn this into a migration sequence so you can roll it out without a big-bang cutover?' },
  ],
  'ch-syn-2': [
    { role: 'user', text: 'Convert this iFrame branded PDF into an editable Word document, and keep the layout and branding intact' },
    { role: 'assistant', text: 'On it — converting your iFrame-branded PDF to an editable Word file. 📄\n\n**Conversion: PDF → Word (.docx)**\n\n• **Layout:** preserved — columns, tables and spacing kept as-is\n• **Branding:** iFrame logo, header/footer and brand colours retained\n• **Fonts:** embedded where available, with close substitutes flagged\n• **Text:** fully selectable and editable (not flattened to images)\n\nYour Word document is ready to download. One heads-up: the cover-page banner is a vector graphic, so I kept it as an image — let me know if you\'d like it rebuilt as editable text instead.' },
  ],
  'ch-syn-3': [
    { role: 'user', text: 'Prepping a prototype showcase of a TRC compliance dashboard for Amazon. What tiles and metrics should the landing view lead with?' },
    { role: 'assistant', text: '**Amazon TRC Compliance Dashboard — Showcase Layout** 📊\n\nLead with health-at-a-glance, then let them drill in.\n\n**Top row — hero tiles:**\n• **Overall Compliance** — single % with trend arrow\n• **Open Findings** — count + severity split\n• **Controls Tested** — fraction (e.g. 142 / 180)\n• **Days to Audit Close** — countdown\n\n**Mid section:**\n• **Risk Heatmap** — likelihood × impact grid\n• **Control Status** — effective / ineffective / not-tested bars\n\n**Flow for the walkthrough:** start on the summary → click a red heatmap cell → land on the failing control → show Ira\'s suggested remediation.\n\nKeep it to one screen so the story stays tight. Want mock numbers to populate the tiles?' },
  ],
  'ch-syn-4': [
    { role: 'user', text: 'Planning a client demo that walks through our Irame vendor folders. Can you sketch a run-of-show?' },
    { role: 'assistant', text: '**Client Demo — iFrame Vendor Folders Run-of-Show** 🎬\n\nKeep it to ~12 minutes, one clear arc per folder.\n\n**1. Set the scene (2 min)**\n• Open the vendor workspace — show folders organized by vendor\n\n**2. Walk a single vendor (5 min)**\n• Open one folder → contracts, certs, evidence all in place\n• Point out Ira flagging an expiring SOC 2 report\n\n**3. Show the payoff (3 min)**\n• Cross-vendor view → risk rollup across the portfolio\n• One-click compliance summary export\n\n**4. Close (2 min)**\n• Recap: *every vendor, one source of truth, audit-ready*\n\nTip: pre-load a folder with a real-looking gap so the flag feels earned. Want a backup vendor in case one folder runs long?' },
  ],
  'ch-syn-5': [
    { role: 'user', text: 'Help me plan a data migration into our new Databricks workspace. We\'re moving our audit and GL datasets off the legacy warehouse.' },
    { role: 'assistant', text: '**Databricks Migration Plan** 🚀\n\nI\'d phase this to keep validation tight at each step:\n\n**Phase 1 — Inventory & landing**\n• Catalog source tables (GL, journal entries, controls, evidence metadata)\n• Land raw extracts into the **bronze** layer as-is (Parquet/Delta)\n\n**Phase 2 — Transform**\n• Clean + conform into **silver** (typed, deduped, FX-normalized)\n• Build **gold** marts: `fct_journal_entries`, `dim_account`, `fct_control_tests`, `dim_entity`\n\n**Phase 3 — Validate**\n• Row counts + control totals vs. legacy (sum of debits/credits must tie)\n• Hash-compare a sampled 5% per table\n• Reconcile period-end balances before sign-off\n\n**Phase 4 — Cutover**\n• Dual-run reports for one close cycle, then switch consumers\n\n📊 **Rough timeline:** ~6–8 weeks\n• Wk 1–2 inventory/landing • Wk 3–5 transform • Wk 6 validation • Wk 7–8 dual-run + cutover\n\nShould I draft the validation checklist as a reconciliation spec you can hand to the data team?' },
  ],
  'ch-syn-6': [
    { role: 'user', text: 'Convert to Word file' },
    { role: 'assistant', text: 'Done! ✅ I\'ve converted your document to an editable Word file (**.docx**).\n\n• Text, headings and lists are fully editable\n• Tables and images kept in place\n• Original formatting preserved\n\nThe file is ready to download. Want me to also save a PDF copy alongside it?' },
  ],
  'ch-syn-7': [
    { role: 'user', text: 'I want to query our SAP data lake for some analytics — vendor spend and duplicate-payment patterns. How should I approach it?' },
    { role: 'assistant', text: '**Querying the SAP Data Lake** 🔍\n\n**Tables you\'ll want:**\n• `BKPF` / `BSEG` — accounting doc headers + line items\n• `LFA1` — vendor master\n• `RBKP` / `RSEG` — invoice receipts\n• `EKKO` / `EKPO` — purchase orders\n\n**Approach:**\n• Join `BSEG` → `LFA1` on vendor to roll up spend by supplier\n• Flag duplicate payments by grouping on `(vendor, amount, invoice ref)` within a tight date window\n• Push aggregations down to the lake engine; pull only summarized results into the analytics layer\n\n📊 **Sample result summary (last 12 months):**\n• Vendors analyzed: 4,210\n• Total spend: $182.4M\n• Top 10 vendors = 61% of spend\n• Potential duplicate payments: 38 pairs flagged ($1.2M exposure)\n\n⚡ Recommend reviewing the flagged duplicates first — highest recovery for least effort. Want me to write out the duplicate-payment query?' },
  ],
  'ch-syn-8': [
    { role: 'user', text: 'How do I write numerical range notation properly — when to use inclusive vs exclusive bounds in a report?' },
    { role: 'assistant', text: 'Good question — here\'s the quick guide. 🔢\n\n**Interval notation**\n• **[a, b]** — both ends included (a ≤ x ≤ b)\n• **(a, b)** — both ends excluded (a < x < b)\n• **[a, b)** — left included, right excluded (a ≤ x < b)\n• **∞** always uses a round bracket: **[0, ∞)**\n\n**In plain report text**\n• \'10–20\' (en dash) usually reads as inclusive of both ends\n• Say \'between 10 and 20 inclusive\' when it must be unambiguous\n• For exclusive limits, write \'greater than 10 and up to 20\'\n\n**Rule of thumb:** square bracket = included, round bracket = excluded. For reader-facing reports, spell out \'inclusive/exclusive\' at least once so there\'s no doubt.' },
  ],
};

// ─── Exception Data (Duplicate Invoice Detection) ───
export const EXCEPTION_DATA = [
  { id: 'EXC-001', invoiceNo: 'INV-2026-4521', vendor: 'Acme Corp', amount: 45200, matchScore: 96, originalInvoice: 'INV-2026-3102', status: 'unassigned' as const, assignee: null as string | null, actionTaken: null as string | null, riskOwner: null as string | null, notificationSent: false },
  { id: 'EXC-002', invoiceNo: 'INV-2026-4533', vendor: 'Global Supplies Ltd', amount: 128750, matchScore: 92, originalInvoice: 'INV-2026-2987', status: 'unassigned' as const, assignee: null as string | null, actionTaken: null as string | null, riskOwner: null as string | null, notificationSent: false },
  { id: 'EXC-003', invoiceNo: 'INV-2026-4558', vendor: 'TechVendor Inc', amount: 67400, matchScore: 88, originalInvoice: 'INV-2026-3241', status: 'assigned' as const, assignee: 'Tushar Goel', actionTaken: null as string | null, riskOwner: 'ro-001', notificationSent: true },
  { id: 'EXC-004', invoiceNo: 'INV-2026-4571', vendor: 'Acme Corp', amount: 23100, matchScore: 94, originalInvoice: 'INV-2026-3455', status: 'in-progress' as const, assignee: 'Deepak Bansal', actionTaken: 'Under investigation', riskOwner: 'ro-002', notificationSent: true },
  { id: 'EXC-005', invoiceNo: 'INV-2026-4589', vendor: 'Pinnacle Services', amount: 89600, matchScore: 78, originalInvoice: 'INV-2026-3012', status: 'resolved' as const, assignee: 'Neha Joshi', actionTaken: 'Confirmed duplicate; payment blocked', riskOwner: 'ro-003', notificationSent: true },
  { id: 'EXC-006', invoiceNo: 'INV-2026-4602', vendor: 'Atlas Manufacturing', amount: 156300, matchScore: 85, originalInvoice: 'INV-2026-2876', status: 'unassigned' as const, assignee: null as string | null, actionTaken: null as string | null, riskOwner: null as string | null, notificationSent: false },
  { id: 'EXC-007', invoiceNo: 'INV-2026-4618', vendor: 'Global Supplies Ltd', amount: 34500, matchScore: 91, originalInvoice: 'INV-2026-3189', status: 'unassigned' as const, assignee: null as string | null, actionTaken: null as string | null, riskOwner: null as string | null, notificationSent: false },
  { id: 'EXC-008', invoiceNo: 'INV-2026-4635', vendor: 'TechVendor Inc', amount: 71800, matchScore: 82, originalInvoice: 'INV-2026-3367', status: 'notified' as const, assignee: 'Karan Mehta', actionTaken: null as string | null, riskOwner: 'ro-004', notificationSent: true },
];

// ─── Risk Owners ───
export const RISK_OWNERS = [
  { id: 'ro-001', name: 'Tushar Goel', role: 'AP Manager', email: 'tushar.goel@company.com', initials: 'TG' },
  { id: 'ro-002', name: 'Deepak Bansal', role: 'Finance Controller', email: 'deepak.bansal@company.com', initials: 'DB' },
  { id: 'ro-003', name: 'Neha Joshi', role: 'Compliance Lead', email: 'neha.joshi@company.com', initials: 'NJ' },
  { id: 'ro-004', name: 'Karan Mehta', role: 'Audit Manager', email: 'karan.mehta@company.com', initials: 'KM' },
  { id: 'ro-005', name: 'Sneha Desai', role: 'Risk Analyst', email: 'sneha.desai@company.com', initials: 'SD' },
];

// ─── Action Taken Data ───
export const ACTION_TAKEN_DATA = [
  { exceptionId: 'EXC-005', action: 'Investigated invoice trail; confirmed duplicate submission by vendor', actionBy: 'Neha Joshi', actionDate: 'Mar 22, 2026', resolution: 'Payment blocked, vendor notified' },
  { exceptionId: 'EXC-004', action: 'Cross-referenced with PO and GRN records', actionBy: 'Deepak Bansal', actionDate: 'Mar 23, 2026', resolution: 'Under review; awaiting vendor response' },
  { exceptionId: 'EXC-003', action: 'Verified against historical payment records', actionBy: 'Tushar Goel', actionDate: 'Mar 21, 2026', resolution: 'Escalated to vendor management' },
  { exceptionId: 'EXC-008', action: 'Initial review completed', actionBy: 'Karan Mehta', actionDate: 'Mar 24, 2026', resolution: 'Pending detailed analysis' },
];

// ─── GRC Exceptions (Case Management · Manage Exceptions page) ───
export type GrcExceptionSeverity = 'High' | 'Medium' | 'Low';
export type GrcExceptionStatus = 'Open' | 'Under Review' | 'Closed';
export type GrcExceptionClassification =
  | 'Unclassified'
  | 'Design Deficiency'
  | 'System Deficiency'
  | 'Procedural Non-Compliance'
  | 'Business as Usual'
  | 'False Positive';
export type GrcReviewStatus = 'Pending' | 'Approved' | 'Rejected' | 'Implemented';

export interface GrcException {
  id: string;
  riskCategory: string;
  severity: GrcExceptionSeverity;
  status: GrcExceptionStatus;
  classification: GrcExceptionClassification;
  classificationReview: GrcReviewStatus;
  actionReview: GrcReviewStatus;
  lastUpdated: string;
  flags?: Array<'Overdue' | 'Bulk'>;
  bulkId?: string;
  /** Auto-generated when the exception is classified as an actionable type
   *  (Design/System Deficiency, Procedural Non-Compliance) — the identifier the
   *  management action plan is tracked under. Cases classified together in a bulk
   *  action share one Actionable ID. Undefined for unclassified / non-actionable. */
  actionableId?: string;
  title: string;
  assignedTo?: { name: string; initials: string };
  /** Full list of bulk-assigned users; `assignedTo` remains the primary (first) for back-compat readers. */
  assignees?: Array<{ name: string; initials: string }>;
  /** Action-plan due date set during classification (ISO YYYY-MM-DD).
   *  When today > dueDate, the row is computed as overdue. */
  dueDate?: string;
  /** Pending/decided request by the Risk Owner to move the action-plan due
   *  date. Requires auditor approval before `dueDate` is actually changed. */
  dueDateRevision?: GrcDueDateRevision;
  /** Two-stage review lifecycle for an actionable management action plan:
   *   'plan-review'       — RO submitted the plan; Auditor must Accept/Reject it
   *   'in-progress'       — plan accepted; RO works on it, then marks complete
   *   'completion-review' — RO marked complete (+ evidence); Auditor reviews outcome
   *  Undefined for unclassified / non-actionable / already-reviewed cases. */
  actionPhase?: 'plan-review' | 'in-progress' | 'completion-review';
}

/** A Risk Owner's request to revise an action-plan due date, gated on auditor
 *  approval. Retains both dates so the panel can show previous vs revised. */
export interface GrcDueDateRevision {
  previousDueDate: string;            // ISO YYYY-MM-DD — the date in effect when requested
  revisedDueDate: string;            // ISO YYYY-MM-DD — the proposed new date
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  requestedBy: string;
  requestedAt: string;               // ISO timestamp
  decisionComment?: string;
  decidedBy?: string;
  decidedAt?: string;                // ISO timestamp
}

export type GrcActivityAuthorRole = 'Auditor' | 'Risk Owner';
export interface GrcActivityEntry {
  id: string;
  author: string;
  role: GrcActivityAuthorRole;
  timestamp: string;
  message: string;
  comment?: string;
  attachment?: { name: string };
}
export type GrcActionStatus = 'Implemented' | 'Partially Implemented' | 'Pending' | 'Discrepancy';
export interface GrcCaseDetail {
  classificationJustification: string;
  actionTitle: string;
  actionDueDate: string;
  actionDescription: string;
  actionStatus: GrcActionStatus;
  activityLog: GrcActivityEntry[];
  /** Full list of action plans the Risk Owner submitted (synced to the Auditor's
   *  review). `actionTitle`/`actionDescription`/`actionDueDate` mirror the first
   *  plan for back-compat with older readers. */
  actionPlans?: { name: string; details: string; dueDate: string }[];
  /** Set when the Risk Owner marks the action complete — the note + evidence the
   *  Auditor reviews before recording the implementation outcome. `selfAssessment`
   *  is the Risk Owner's own read (Implemented / Partially Implemented) that the
   *  Auditor sees and then confirms or overrides. */
  completion?: { note: string; evidence: { name: string }[]; completedAt: string; selfAssessment?: 'Implemented' | 'Partially Implemented' };
}
export interface GrcBulkAction {
  id: string;
  caseIds: string[];
  title: string;
}

const PERSON = {
  RK: { name: 'Ravi Kumar',  initials: 'RK' },
  SR: { name: 'Sunita Rao',  initials: 'SR' },
  AS: { name: 'Arun Singh',  initials: 'AS' },
};

export const GRC_EXCEPTIONS: GrcException[] = [
  { id: 'EXC001', riskCategory: 'Access Control',    severity: 'High',   status: 'Under Review', classification: 'Design Deficiency',        classificationReview: 'Pending',     actionReview: 'Pending',     lastUpdated: '2 days ago',   flags: ['Overdue', 'Bulk'], bulkId: 'ACT002', title: 'Unauthorized Admin Access via Legacy VPN Endpoint',                   assignedTo: PERSON.RK },
  { id: 'EXC002', riskCategory: 'Data Privacy',      severity: 'High',   status: 'Open',         classification: 'Unclassified',             classificationReview: 'Pending',     actionReview: 'Pending',     lastUpdated: '1 day ago',                        title: 'Customer PII Stored in Unencrypted S3 Buckets',                       assignedTo: PERSON.SR },
  { id: 'EXC003', riskCategory: 'Financial Controls',severity: 'High',   status: 'Closed',       classification: 'System Deficiency',        classificationReview: 'Approved',    actionReview: 'Approved',lastUpdated: '3 days ago',   flags: ['Bulk'], bulkId: 'ACT001', title: 'Vendor Invoice Approval Bypassed for Transactions Over $50K',         assignedTo: PERSON.AS },
  { id: 'EXC004', riskCategory: 'IT Security',       severity: 'High',   status: 'Under Review', classification: 'System Deficiency',        classificationReview: 'Pending',     actionReview: 'Pending',     lastUpdated: '3 days ago',   flags: ['Bulk'], bulkId: 'ACT001', title: 'Missing MFA for C-Suite Remote Access',                               assignedTo: PERSON.AS, dueDate: '2026-06-20' },
  { id: 'EXC005', riskCategory: 'Compliance',        severity: 'High',   status: 'Open',         classification: 'Procedural Non-Compliance',classificationReview: 'Pending',     actionReview: 'Pending',     lastUpdated: '2 days ago',   flags: ['Overdue', 'Bulk'], bulkId: 'ACT002', title: 'GDPR Data Subject Requests Exceeding 30-Day SLA',                     assignedTo: PERSON.SR },
  { id: 'EXC006', riskCategory: 'Financial Controls',severity: 'High',   status: 'Closed',       classification: 'Design Deficiency',        classificationReview: 'Approved',    actionReview: 'Approved',lastUpdated: '15 days ago',  bulkId: 'ACT004', title: 'Trading Desk Reconciliation Errors in Q3',                            assignedTo: PERSON.RK },
  { id: 'EXC007', riskCategory: 'IT Security',       severity: 'Medium', status: 'Open',         classification: 'Unclassified',             classificationReview: 'Pending',     actionReview: 'Pending',     lastUpdated: 'about 7 hours ago',                title: 'Firewall Rule Permits Unrestricted Outbound Traffic' },
  { id: 'EXC008', riskCategory: 'Compliance',        severity: 'High',   status: 'Open',         classification: 'Business as Usual',        classificationReview: 'Pending',     actionReview: 'Pending',     lastUpdated: '4 days ago',                       title: 'Missing Security Log Retention on Payment Processing System',         assignedTo: PERSON.SR },
  { id: 'EXC009', riskCategory: 'Operational Risk',  severity: 'Medium', status: 'Open',         classification: 'Unclassified',             classificationReview: 'Pending',     actionReview: 'Pending',     lastUpdated: '5 days ago',                       title: 'Inadequate Access Review for Terminated Contractors' },
  { id: 'EXC010', riskCategory: 'Financial Controls',severity: 'High',   status: 'Closed',       classification: 'System Deficiency',        classificationReview: 'Approved',    actionReview: 'Approved',lastUpdated: '12 days ago',  bulkId: 'ACT005', title: 'Duplicate Payments to 3 Vendors (Oct-Nov)',                           assignedTo: PERSON.AS },
  { id: 'EXC011', riskCategory: 'IT Security',       severity: 'Medium', status: 'Open',         classification: 'False Positive',           classificationReview: 'Approved',    actionReview: 'Approved',lastUpdated: '6 days ago',                       title: 'Service Account API Key Usage: policy-exempt accounts',              assignedTo: PERSON.SR },
  { id: 'EXC012', riskCategory: 'Data Privacy',      severity: 'High',   status: 'Open',         classification: 'Procedural Non-Compliance',classificationReview: 'Pending',     actionReview: 'Rejected',   lastUpdated: '1 day ago',   bulkId: 'ACT006', title: 'Customer Data Shared with Unauthorized Third-Party',                  assignedTo: PERSON.RK },
  { id: 'EXC013', riskCategory: 'Compliance',        severity: 'Low',    status: 'Open',         classification: 'Procedural Non-Compliance',classificationReview: 'Pending',     actionReview: 'Pending',     lastUpdated: '20 days ago', flags: ['Bulk'], bulkId: 'ACT003', title: 'CAB Approval Bypassed for Production Change',                         assignedTo: PERSON.RK, dueDate: '2026-06-15', dueDateRevision: { previousDueDate: '2026-06-15', revisedDueDate: '2026-07-10', reason: 'Awaiting the vendor’s patched CAB module (ETA early July) before the control can be enforced and evidenced.', status: 'Pending', requestedBy: 'Rohan Kapoor', requestedAt: '2026-06-03T11:20:00.000Z' } },
  { id: 'EXC014', riskCategory: 'Access Control',    severity: 'Medium', status: 'Open',         classification: 'Design Deficiency',        classificationReview: 'Pending',     actionReview: 'Pending',     lastUpdated: '8 days ago',  flags: ['Bulk'], bulkId: 'ACT003', title: 'Change Management System: CAB approval not enforced',                assignedTo: PERSON.SR, dueDate: '2026-06-25' },
];

export const GRC_BULK_ACTIONS: Record<string, GrcBulkAction> = {
  'ACT001': { id: 'ACT001', caseIds: ['EXC003', 'EXC004'],           title: 'MFA enforcement · executive accounts' },
  'ACT002': { id: 'ACT002', caseIds: ['EXC001', 'EXC005'],           title: 'Legacy access & SLA remediation bundle' },
  'ACT003': { id: 'ACT003', caseIds: ['EXC013', 'EXC014'],           title: 'CAB approval enforcement · change mgmt' },
  'ACT004': { id: 'ACT004', caseIds: ['EXC006'],                     title: 'Q3 trading reconciliation fix' },
  'ACT005': { id: 'ACT005', caseIds: ['EXC010'],                     title: 'Vendor duplicate payment recovery' },
  'ACT006': { id: 'ACT006', caseIds: ['EXC012'],                     title: 'Third-party data share review' },
};

const DEFAULT_ACTIVITY: GrcActivityEntry[] = [
  {
    id: 'act-1',
    author: 'Priya Mehta',
    role: 'Auditor',
    timestamp: '21 Apr 2026, 18:00',
    message: 'Accepted action — marked Pending Review, awaiting implementation verification',
    comment: 'Action plan is comprehensive. Monitoring the completion of the decommission ticket by Nov 30.',
  },
  {
    id: 'act-2',
    author: 'Priya Mehta',
    role: 'Auditor',
    timestamp: '20 Apr 2026, 18:00',
    message: 'Reviewed case and submitted for final decision',
  },
  {
    id: 'act-3',
    author: 'Ravi Kumar',
    role: 'Risk Owner',
    timestamp: '18 Apr 2026, 18:00',
    message: 'Action submitted: Access Control Remediation',
    attachment: { name: 'vpn_remediation_plan.pdf' },
  },
  {
    id: 'act-4',
    author: 'Ravi Kumar',
    role: 'Risk Owner',
    timestamp: '16 Apr 2026, 10:30',
    message: 'Classified exception as Design Deficiency',
  },
  {
    id: 'act-5',
    author: 'System',
    role: 'Auditor',
    timestamp: '15 Apr 2026, 09:00',
    message: 'Case assigned to Ravi Kumar (Risk Owner)',
  },
];

export const GRC_CASE_DETAILS: Record<string, GrcCaseDetail> = {
  'EXC001': {
    classificationJustification:
      '"The VPN endpoint was intentionally kept active for legacy integrations, but lacked proper access controls. This is a design gap that requires immediate remediation."',
    actionTitle: 'Access Control Remediation · legacy VPN endpoint',
    actionDueDate: 'Due 30 Apr 2026',
    actionDescription:
      'Decommissioned the legacy VPN endpoint and routed remaining integrations through the corporate SSO gateway. MFA enforced, audit logs shipped to Splunk, and evidence captured in the remediation workbook.',
    actionStatus: 'Pending',
    activityLog: DEFAULT_ACTIVITY,
  },
  'EXC003': {
    classificationJustification:
      '"Unauthorized MFA bypass was configured at the system level without Security Committee approval. This is a system deficiency."',
    actionTitle: 'MFA Policy Enforcement for Executive Accounts',
    actionDueDate: 'Due 05 May 2026',
    actionDescription:
      'Removed MFA bypass configuration for all 6 C-suite accounts. Implemented hardware security key (FIDO2) as primary MFA method for executive accounts with a 30-day transition window. Security Committee formally notified and approval process documented.',
    actionStatus: 'Partially Implemented',
    activityLog: DEFAULT_ACTIVITY,
  },
  'EXC004': {
    classificationJustification:
      '"Same MFA bypass pattern observed on engineering administrator accounts. Classified as system deficiency pending remediation."',
    actionTitle: 'MFA Policy Enforcement for Admin Accounts',
    actionDueDate: 'Due 12 May 2026',
    actionDescription:
      'Admin account MFA bypass is being removed in waves. Wave 1 complete; waves 2–3 scheduled before due date.',
    actionStatus: 'Pending',
    activityLog: DEFAULT_ACTIVITY,
  },
  'EXC005': {
    classificationJustification:
      '"Vendor onboarding checklist was skipped for three engagements in Q1. Procedural gap, not a design or system flaw."',
    actionTitle: 'Vendor Onboarding Checklist Backfill',
    actionDueDate: 'Due 02 May 2026',
    actionDescription:
      'Backfilling onboarding documentation for the three engagements; adding a gating control in the intake workflow so future engagements cannot proceed without a signed checklist.',
    actionStatus: 'Pending',
    activityLog: DEFAULT_ACTIVITY,
  },
  'EXC008': {
    classificationJustification:
      '"Control operated as designed; the observed variance is within tolerance. No remediation required."',
    actionTitle: 'No action required · documented rationale',
    actionDueDate: 'Due 28 Apr 2026',
    actionDescription:
      'Auditor requested confirmation that variance is within tolerance. Evidence pack attached.',
    actionStatus: 'Implemented',
    activityLog: DEFAULT_ACTIVITY,
  },
  'EXC012': {
    classificationJustification:
      '"Endpoint isolation policy was not enforced on the engineering ring; system-level gap in the MDM baseline."',
    actionTitle: 'Endpoint Isolation Baseline Rollout',
    actionDueDate: 'Due 20 May 2026',
    actionDescription:
      'Rolling out the hardened isolation baseline to the engineering ring. Staged pilot complete; full rollout scheduled over next 10 business days.',
    actionStatus: 'Pending',
    activityLog: DEFAULT_ACTIVITY,
  },
};

// ─── Action Hub (Case Mgmt > Action Hub tab) ───
export type ActionHubActorRole = 'Risk Owner' | 'Auditor' | 'Ira (AI)' | 'System';

export interface ActionHubEvent {
  id: string;
  date: string;              // "23 Apr 2026"
  time: string;              // "19:06"
  relative: string;          // "29 minutes ago"
  actor: string;             // "Priya Mehta" / "Ira (AI)" / "System"
  role: ActionHubActorRole;
  message: string;
  exceptionId: string;
  comment?: string;
  attachment?: { name: string };
}

export const ACTION_HUB_SUMMARY = {
  auditPeriod: 'FY 2024–25',
  viewedBy: 'Ravi Kumar',
  reportHealthPct: 72,
  reportHealthLabel: 'Good' as const,
  atrReadiness: {
    completedSteps: 0,
    totalSteps: 3,
    overallPct: 60,
    steps: [
      { id: 'step-1', label: 'All exceptions classified',           current: 10, total: 14 },
      { id: 'step-3', label: 'Action Plan submitted by Risk Owner', current: 5,  total: 8  },
      { id: 'step-4', label: 'Auditor review complete',             current: 3,  total: 10 },
    ],
  },
  overdue: [
    { id: 'EXC001', overdueLabel: '5d overdue' },
    { id: 'EXC005', overdueLabel: '3d overdue' },
  ],
  counts: {
    total: 14,
    classified: 10,
    actionPlans: 6,
    underReview: 2,
    resolved: 3,
    overdue: 2,
  },
  riskOwner: {
    name: 'Ravi Kumar',
    initials: 'RK',
    role: 'Risk Owner' as const,
    totalActions: 16,
    tiles: [
      { label: 'Classifications',     value: 10, tone: 'brand'     as const },
      { label: 'Action Plans Filed',  value: 6,  tone: 'compliant' as const },
      { label: 'Bulk Actions',        value: 2,  tone: 'brand'     as const },
      { label: 'Individual Actions',  value: 4,  tone: 'evidence'  as const },
    ],
  },
  auditor: {
    name: 'Priya Mehta',
    initials: 'PM',
    role: 'Auditor' as const,
    totalActions: 6,
    tiles: [
      { label: 'Reviews Performed',   value: 5, tone: 'brand'     as const },
      { label: 'Approved / Accepted', value: 2, tone: 'compliant' as const },
      { label: 'Rejected',            value: 1, tone: 'risk'      as const },
      { label: 'Cases Closed',        value: 3, tone: 'brand'     as const },
    ],
  },
  classificationBreakdown: {
    classified: 10,
    unclassified: 4,
    bulk: 2,
    individual: 8,
    rows: [
      { label: 'Design Deficiency',         count: 3, tone: 'high'      as const },
      { label: 'System Deficiency',         count: 3, tone: 'risk'      as const, underline: true },
      { label: 'Procedural Non-Compliance', count: 2, tone: 'brand'     as const },
      { label: 'Business as Usual',         count: 1, tone: 'compliant' as const },
      { label: 'False Positive',            count: 1, tone: 'draft'     as const },
    ],
  },
};

export const ACTION_HUB_TIMELINE: ActionHubEvent[] = [
  { id: 'ev-01', date: '23 Apr 2026', time: '19:06', relative: '29 minutes ago', actor: 'Priya Mehta', role: 'Auditor',    message: 'Case accepted. Marked as Partially Implemented',                  exceptionId: 'EXC003' },

  { id: 'ev-02', date: '22 Apr 2026', time: '18:00', relative: '1 day ago',     actor: 'System',      role: 'System',     message: 'Case reopened after auditor rejection',                            exceptionId: 'EXC012' },
  { id: 'ev-03', date: '22 Apr 2026', time: '18:00', relative: '1 day ago',     actor: 'Priya Mehta', role: 'Auditor',    message: 'Rejected. Discrepancy raised',                                     exceptionId: 'EXC012', comment: '"The submitted action does not adequately address the regulatory notification requirement under GDPR Article 33."' },
  { id: 'ev-04', date: '22 Apr 2026', time: '18:00', relative: '1 day ago',     actor: 'Arun Singh',  role: 'Risk Owner', message: 'Classified as Design Deficiency',                                  exceptionId: 'EXC014', comment: '"Change management system does not enforce CAB approval before production deployments."' },

  { id: 'ev-05', date: '21 Apr 2026', time: '18:00', relative: '2 days ago',    actor: 'Priya Mehta', role: 'Auditor',    message: 'Accepted action — marked Pending Review, awaiting implementation verification', exceptionId: 'EXC001', comment: '"Action plan is comprehensive. Monitoring the completion of the decommission ticket by Nov 30."' },
  { id: 'ev-06', date: '21 Apr 2026', time: '18:00', relative: '2 days ago',    actor: 'Sunita Rao',  role: 'Risk Owner', message: 'Classified as Procedural Non-Compliance',                          exceptionId: 'EXC005', comment: '"The DSR process lacks automation and escalation rules."' },
  { id: 'ev-07', date: '21 Apr 2026', time: '18:00', relative: '2 days ago',    actor: 'Ira (AI)',    role: 'Ira (AI)',   message: 'Exception flagged by Ira (AI) with 72% confidence',                exceptionId: 'EXC013' },

  { id: 'ev-08', date: '20 Apr 2026', time: '18:00', relative: '3 days ago',    actor: 'Priya Mehta', role: 'Auditor',    message: 'Reviewed case and submitted for final decision',                   exceptionId: 'EXC001' },
  { id: 'ev-09', date: '20 Apr 2026', time: '18:00', relative: '3 days ago',    actor: 'Ira (AI)',    role: 'Ira (AI)',   message: 'Exception flagged by Ira (AI) with 82% confidence',                exceptionId: 'EXC007' },
  { id: 'ev-10', date: '20 Apr 2026', time: '18:00', relative: '3 days ago',    actor: 'Sunita Rao',  role: 'Risk Owner', message: 'Classified as False Positive',                                     exceptionId: 'EXC011', comment: '"API keys flagged are exempt service accounts per Security Policy Exception SEC-EX-2023-14."' },

  { id: 'ev-11', date: '19 Apr 2026', time: '18:00', relative: '4 days ago',    actor: 'Sunita Rao',  role: 'Risk Owner', message: 'Classified as Business as Usual',                                  exceptionId: 'EXC008', comment: '"Logging gap was an operational oversight during maintenance. Compensating controls documented."' },
  { id: 'ev-12', date: '19 Apr 2026', time: '18:00', relative: '4 days ago',    actor: 'Ira (AI)',    role: 'Ira (AI)',   message: 'Exception flagged by Ira (AI) with 81% confidence',                exceptionId: 'EXC014' },

  { id: 'ev-13', date: '18 Apr 2026', time: '18:00', relative: '5 days ago',    actor: 'Ravi Kumar',  role: 'Risk Owner', message: 'Action submitted: Access Control Remediation',                     exceptionId: 'EXC001', attachment: { name: 'vpn_remediation_plan.pdf' } },
  { id: 'ev-14', date: '18 Apr 2026', time: '18:00', relative: '5 days ago',    actor: 'Ira (AI)',    role: 'Ira (AI)',   message: 'Exception flagged by Ira (AI) with 94% confidence',                exceptionId: 'EXC002' },
  { id: 'ev-15', date: '18 Apr 2026', time: '18:00', relative: '5 days ago',    actor: 'Ravi Kumar',  role: 'Risk Owner', message: 'Action submitted: Unauthorized Data Share Remediation',            exceptionId: 'EXC012' },

  { id: 'ev-16', date: '17 Apr 2026', time: '18:00', relative: '6 days ago',    actor: 'Ira (AI)',    role: 'Ira (AI)',   message: 'Exception flagged by Ira (AI) with 79% confidence',                exceptionId: 'EXC009' },

  { id: 'ev-17', date: '16 Apr 2026', time: '18:00', relative: '7 days ago',    actor: 'Ravi Kumar',  role: 'Risk Owner', message: 'Classified as Design Deficiency',                                  exceptionId: 'EXC001', comment: '"The VPN endpoint was intentionally kept active for legacy integrations, but lacked proper access controls."' },
  { id: 'ev-18', date: '16 Apr 2026', time: '18:00', relative: '7 days ago',    actor: 'Ira (AI)',    role: 'Ira (AI)',   message: 'Exception flagged by Ira (AI) with 86% confidence',                exceptionId: 'EXC005' },

  { id: 'ev-19', date: '15 Apr 2026', time: '18:00', relative: '8 days ago',    actor: 'Arun Singh',  role: 'Risk Owner', message: 'Bulk action submitted under ACT001',                         exceptionId: 'EXC003', attachment: { name: 'erp_config_patch_notes.pdf' } },
  { id: 'ev-20', date: '15 Apr 2026', time: '18:00', relative: '8 days ago',    actor: 'Arun Singh',  role: 'Risk Owner', message: 'Bulk action submitted under ACT001',                         exceptionId: 'EXC004' },
  { id: 'ev-21', date: '15 Apr 2026', time: '18:00', relative: '8 days ago',    actor: 'Ira (AI)',    role: 'Ira (AI)',   message: 'Exception flagged by Ira (AI) with 84% confidence',                exceptionId: 'EXC010' },

  { id: 'ev-22', date: '14 Apr 2026', time: '18:00', relative: '9 days ago',    actor: 'Ira (AI)',    role: 'Ira (AI)',   message: 'Exception flagged by Ira (AI) with 88% confidence',                exceptionId: 'EXC008' },

  { id: 'ev-23', date: '13 Apr 2026', time: '18:00', relative: '10 days ago',   actor: 'Ira (AI)',    role: 'Ira (AI)',   message: 'Exception flagged by Ira (AI) with 97% confidence',                exceptionId: 'EXC001' },

  { id: 'ev-24', date: '11 Apr 2026', time: '18:00', relative: '12 days ago',   actor: 'Arun Singh',  role: 'Risk Owner', message: 'Bulk classified as System Deficiency under ACT001',          exceptionId: 'EXC003', comment: '"ERP configuration error in v2.3 upgrade removed the dual-approval requirement."' },
  { id: 'ev-25', date: '11 Apr 2026', time: '18:00', relative: '12 days ago',   actor: 'Arun Singh',  role: 'Risk Owner', message: 'Bulk classified as System Deficiency under ACT001',          exceptionId: 'EXC004', comment: '"Unauthorized MFA bypass configured at system level without proper approval."' },

  { id: 'ev-26', date: '09 Apr 2026', time: '18:00', relative: '14 days ago',   actor: 'Ira (AI)',    role: 'Ira (AI)',   message: 'Exception flagged by Ira (AI) with 91% confidence',                exceptionId: 'EXC003' },
  { id: 'ev-27', date: '09 Apr 2026', time: '18:00', relative: '14 days ago',   actor: 'Ira (AI)',    role: 'Ira (AI)',   message: 'Exception flagged by Ira (AI) with 89% confidence',                exceptionId: 'EXC004' },

  { id: 'ev-28', date: '08 Apr 2026', time: '18:00', relative: '15 days ago',   actor: 'Ira (AI)',    role: 'Ira (AI)',   message: 'Exception flagged by Ira (AI) with 78% confidence',                exceptionId: 'EXC006' },
  { id: 'ev-29', date: '08 Apr 2026', time: '18:00', relative: '15 days ago',   actor: 'Ravi Kumar',  role: 'Risk Owner', message: 'Classified as Design Deficiency',                                  exceptionId: 'EXC006', comment: '"Quarterly vendor review was skipped; design-level remediation scheduled."' },

  { id: 'ev-30', date: '06 Apr 2026', time: '18:00', relative: '17 days ago',   actor: 'Priya Mehta', role: 'Auditor',    message: 'Closed case. Resolution verified',                                 exceptionId: 'EXC006' },
  { id: 'ev-31', date: '06 Apr 2026', time: '18:00', relative: '17 days ago',   actor: 'Ira (AI)',    role: 'Ira (AI)',   message: 'Exception flagged by Ira (AI) with 92% confidence',                exceptionId: 'EXC011' },

  { id: 'ev-32', date: '04 Apr 2026', time: '18:00', relative: '19 days ago',   actor: 'Priya Mehta', role: 'Auditor',    message: 'Closed case. No further action required',                          exceptionId: 'EXC010' },
  { id: 'ev-33', date: '04 Apr 2026', time: '18:00', relative: '19 days ago',   actor: 'Ira (AI)',    role: 'Ira (AI)',   message: 'Exception flagged by Ira (AI) with 77% confidence',                exceptionId: 'EXC013' },

  { id: 'ev-34', date: '02 Apr 2026', time: '18:00', relative: '21 days ago',   actor: 'Priya Mehta', role: 'Auditor',    message: 'Closed case. Resolution verified',                                 exceptionId: 'EXC013' },
  { id: 'ev-35', date: '02 Apr 2026', time: '18:00', relative: '21 days ago',   actor: 'System',      role: 'System',     message: 'Case auto-assigned to risk owner queue',                           exceptionId: 'EXC002' },
  { id: 'ev-36', date: '02 Apr 2026', time: '18:00', relative: '21 days ago',   actor: 'Ira (AI)',    role: 'Ira (AI)',   message: 'Exception flagged by Ira (AI) with 83% confidence',                exceptionId: 'EXC007' },

  { id: 'ev-37', date: '01 Apr 2026', time: '18:00', relative: '22 days ago',   actor: 'System',      role: 'System',     message: 'Audit cycle opened for FY 2024–25',                                exceptionId: '—' },
];

// ─── Email Template ───
export const EMAIL_TEMPLATE = {
  subject: 'Action Required: Duplicate Invoice Exception Assigned',
  from: 'Auditify Copilot <noreply@auditify.ai>',
  body: (recipientName: string, exceptionId: string, invoiceNo: string, vendor: string, amount: number) => `
Dear ${recipientName},

A duplicate invoice exception has been assigned to you for review and action.

Exception Details:
• Exception ID: ${exceptionId}
• Invoice: ${invoiceNo}
• Vendor: ${vendor}
• Amount: $${amount.toLocaleString()}

Please review the flagged transaction and take appropriate action within 48 hours.

Actions Required:
1. Review the invoice against the original transaction
2. Verify with the vendor if necessary
3. Approve, block, or escalate the payment
4. Document your findings in Auditify

Access the exception directly:
https://auditify.ai/exceptions/${exceptionId}

Best regards,
Auditify Copilot
Automated Audit Intelligence Platform
  `.trim(),
};

// ─── Power BI Dashboards ───
export const POWER_BI_DASHBOARDS = [
  { id: 'pbi-001', name: 'Finance Overview FY26', workspace: 'Corporate Finance', tiles: 6, lastRefresh: 'Mar 20, 2026', selected: false },
  { id: 'pbi-002', name: 'Vendor Spend Analysis', workspace: 'Procurement', tiles: 8, lastRefresh: 'Mar 19, 2026', selected: false },
  { id: 'pbi-003', name: 'Compliance Scorecard', workspace: 'Risk & Compliance', tiles: 5, lastRefresh: 'Mar 18, 2026', selected: false },
  { id: 'pbi-004', name: 'AP Aging Report', workspace: 'Corporate Finance', tiles: 4, lastRefresh: 'Mar 22, 2026', selected: false },
];

// ─── Clarification Steps (Duplicate Invoice Query) ───
export const CLARIFICATION_STEPS = [
  {
    stage: 1,
    question: "I'll analyze your invoice data for duplicates across the connected source. First, what date range should I cover for this run?",
    options: ['Last 30 days', 'Last 90 days', 'Full FY26', 'Custom range'],
    fillPercent: 25,
    category: 'Intent',
  },
  {
    stage: 2,
    question: 'What tolerance threshold should I apply to amount matching? Some duplicate invoices may have slight rounding or currency variations.',
    options: ['Exact match only', '± 1% tolerance', '± 5% tolerance'],
    fillPercent: 50,
    category: 'Data',
  },
  {
    stage: 3,
    question: 'Which vendor scope should I analyze for this duplicate-detection run across the AP module?',
    options: ['All vendors', 'Top 50 by spend', 'Flagged vendors only', 'Specific vendor'],
    fillPercent: 75,
    category: 'Logic',
  },
  {
    stage: 4,
    question: 'What matching logic should I use to detect duplicates between candidate invoice pairs in your data?',
    options: ['Invoice number + amount', 'Fuzzy match all fields', 'AI-powered pattern detection'],
    multi: true, // matching logic can legitimately combine several methods
    fillPercent: 100,
    category: 'Ready',
  },
];

// ─── Workflow Build Clarification Steps ───
export const WORKFLOW_CLARIFICATION_STEPS = [
  {
    stage: 1,
    question: "I'll build this workflow for you. First, which data source should I connect to?",
    options: ['SAP ERP: AP Module', 'CSV / Excel Upload', 'Multiple Sources (SAP + CSV)', 'Custom Database'],
    fillPercent: 20,
    category: 'Data Source',
    canvasSection: 'overview',
  },
  {
    stage: 2,
    question: 'What specific pattern should the workflow detect?',
    options: ['Duplicate invoices (same vendor + amount)', 'Anomalous payment amounts', 'Unauthorized vendor changes', 'SOD violations'],
    fillPercent: 40,
    category: 'Detection Logic',
    canvasSection: 'steps',
  },
  {
    stage: 3,
    question: 'What business rules and thresholds should I apply?',
    options: ['Fuzzy match with 5% tolerance', 'Exact match only', 'AI-powered pattern detection', 'Custom rules (amount > 10L)'],
    fillPercent: 60,
    category: 'Rules',
    canvasSection: 'suggestions',
  },
  {
    stage: 4,
    question: 'Confirm the input and output fields for this workflow:',
    options: ['Use recommended I/O fields', 'Add vendor category filter', 'Include historical comparison', 'Custom fields'],
    fillPercent: 80,
    category: 'Input / Output',
    canvasSection: 'io',
  },
  {
    stage: 5,
    question: 'Here\'s the AI-recommended output screen for your workflow. Should I finalize this layout?',
    options: ['Looks great, finalize', 'Switch to dashboard layout', 'Switch to chat-based layout', 'Customize further'],
    fillPercent: 100,
    category: 'Output Layout',
    canvasSection: 'preview',
  },
];

// ─── Workflow Assumptions per Clarification Step ───
export const WORKFLOW_ASSUMPTIONS: Record<number, string[]> = {
  1: ['Connecting via read-only access', 'Using production dataset (not staging)', 'Default timeout: 30 seconds'],
  2: ['Matching on invoice number + vendor + amount fields', 'Excluding voided invoices', 'Looking back 12 months for historical matches'],
  3: ['Tolerance applies to amount field only', 'Vendor name matching uses exact match', 'Currency conversion handled by source system'],
  4: ['Date format: DD-MMM-YYYY', 'Amount includes tax', 'Output sorted by match score descending'],
  5: ['Standard layout selected', 'Results auto-refresh on new data', 'Max 100 rows per page in output table'],
};

// ─── Reconciliation Clarification Steps ───
export const RECONCILIATION_CLARIFICATION_STEPS = [
  {
    stage: 1,
    question: "I'll set up a Three-Way PO Match reconciliation. First \u2014 which data sources do you want to include?",
    options: ['All 4 sources (PO + GRN + Invoice + Master)', 'PO + Invoice only (skip GRN)', 'Custom selection'],
    category: 'Data Sources',
  },
  {
    stage: 2,
    question: "The Vendor Master Data was last refreshed on Mar 20. Should I freeze it for this run, or do you want to upload a fresh copy?",
    options: ['Freeze current version (Mar 20)', 'Upload new master data', 'Skip master data validation'],
    category: 'File Freeze',
  },
  {
    stage: 3,
    question: "What match tolerance should I use for amount variance?",
    options: ['Exact match (0%)', '\u00b1 1% tolerance', '\u00b1 5% tolerance', 'AI-recommended threshold'],
    category: 'Match Rules',
  },
  {
    stage: 4,
    question: "I've configured the inputs. Now let's customize the output. Which layout do you prefer?",
    options: ['Table view (all columns)', 'Dashboard (KPIs + summary table)', 'Split view (matched vs unmatched)'],
    category: 'Output Layout',
  },
  {
    stage: 5,
    question: "Here's the output preview with sample data. Ready to run the reconciliation?",
    options: ['Run now', 'Save as workflow template first', 'Customize columns before running'],
    category: 'Confirm & Run',
  },
];

// ─── Dashboard Widgets ───
export const DASHBOARD_WIDGETS = [
  { id: "dw-001", type: "kpi", title: "Total Risks", value: 12, change: "+2", trend: "up" },
  { id: "dw-002", type: "kpi", title: "Controls Tested", value: 14, total: 24, change: "+3", trend: "up" },
  { id: "dw-003", type: "kpi", title: "Deficiencies Open", value: 2, change: "-1", trend: "down" },
  { id: "dw-004", type: "kpi", title: "Workflow Runs (MTD)", value: 156, change: "+23", trend: "up" },
  { id: "dw-005", type: "donut", title: "Risk by Severity", data: { critical: 2, high: 5, medium: 3, low: 2 } },
  { id: "dw-006", type: "bar", title: "Control Effectiveness", data: { effective: 11, ineffective: 1, "not-tested": 2 } },
  { id: "dw-007", type: "progress", title: "Audit Progress · FY26 SOX", value: 58 },
  { id: "dw-008", type: "list", title: "Recent Workflow Runs", items: ["Duplicate Invoice Detector · 2h ago", "Vendor Master Monitor · 4h ago", "Journal Entry Anomaly · 1d ago"] },
];

// ─── SOP Process Flows ───
export const SOP_FLOWS: Record<string, Array<{ id: string; label: string; type: 'start' | 'process' | 'decision' | 'end'; next?: string[] }>> = {
  'sop-001': [ // Vendor Payment SOP - P2P
    { id: 's1', label: 'Invoice received\nvia AP portal', type: 'start', next: ['s2'] },
    { id: 's2', label: 'OCR scan &\ndata extraction', type: 'process', next: ['s3'] },
    { id: 's3', label: 'Three-way match\nPO ↔ GRN ↔ Invoice', type: 'process', next: ['s4'] },
    { id: 's4', label: 'Match within\n5% tolerance?', type: 'decision', next: ['s5', 's6'] },
    { id: 's5', label: 'Auto-route to\nL1 Approver\n(< ₹10L)', type: 'process', next: ['s7'] },
    { id: 's6', label: 'Flag for AP\nManager review', type: 'process', next: ['s8'] },
    { id: 's7', label: 'L2 Approval\nrequired?\n(> ₹10L)', type: 'decision', next: ['s9', 's10'] },
    { id: 's8', label: 'Manual\nresolution &\nvendor callback', type: 'process', next: ['s3'] },
    { id: 's9', label: 'Finance Controller\nsign-off', type: 'process', next: ['s10'] },
    { id: 's10', label: 'Schedule payment\nin next batch run', type: 'process', next: ['s11'] },
    { id: 's11', label: 'Payment released\n& posted to GL', type: 'end' },
  ],
  'sop-002': [ // Purchase Order SOP - P2P
    { id: 's1', label: 'Purchase\nrequisition (PR)\nraised by dept', type: 'start', next: ['s2'] },
    { id: 's2', label: 'Budget availability\ncheck in SAP', type: 'process', next: ['s3'] },
    { id: 's3', label: 'Budget\nsufficient?', type: 'decision', next: ['s4', 's5'] },
    { id: 's4', label: 'Auto-generate PO\nfrom approved PR', type: 'process', next: ['s6'] },
    { id: 's5', label: 'Route to Dept Head\nfor budget override', type: 'process', next: ['s7'] },
    { id: 's6', label: 'Vendor selection\nfrom approved\nvendor list (AVL)', type: 'process', next: ['s8'] },
    { id: 's7', label: 'Override\napproved?', type: 'decision', next: ['s4', 's9'] },
    { id: 's8', label: 'PO dispatched\nto vendor via EDI', type: 'process', next: ['s10'] },
    { id: 's9', label: 'PR rejected.\nRequestor notified', type: 'end' },
    { id: 's10', label: 'GRN created on\ngoods receipt', type: 'end' },
  ],
  'sop-003': [ // Invoice Management SOP - O2C
    { id: 's1', label: 'Sales order\nconfirmed in CRM', type: 'start', next: ['s2'] },
    { id: 's2', label: 'Delivery &\nshipping confirmed', type: 'process', next: ['s3'] },
    { id: 's3', label: 'Auto-generate\ninvoice from SO', type: 'process', next: ['s4'] },
    { id: 's4', label: 'Customer credit\nlimit check', type: 'decision', next: ['s5', 's6'] },
    { id: 's5', label: 'Invoice sent\nto customer\nvia e-invoicing', type: 'process', next: ['s7'] },
    { id: 's6', label: 'Hold & route to\nCredit Manager', type: 'process', next: ['s8'] },
    { id: 's7', label: 'Payment\nreceived within\nterms?', type: 'decision', next: ['s9', 's10'] },
    { id: 's8', label: 'Credit decision:\napprove / reject', type: 'decision', next: ['s5', 's11'] },
    { id: 's9', label: 'Cash applied &\nreconciled in AR', type: 'end' },
    { id: 's10', label: 'Dunning notice\nsent (30/60/90)', type: 'process', next: ['s7'] },
    { id: 's11', label: 'Order cancelled\n& customer notified', type: 'end' },
  ],
  'sop-004': [ // Financial Close SOP - R2R
    { id: 's1', label: 'Period-end\ncutoff triggered\n(T+0)', type: 'start', next: ['s2'] },
    { id: 's2', label: 'Sub-ledger\npostings frozen\n(AP/AR/FA)', type: 'process', next: ['s3'] },
    { id: 's3', label: 'Inter-company\nelimination entries', type: 'process', next: ['s4'] },
    { id: 's4', label: 'Sub-ledger to\nGL reconciliation', type: 'process', next: ['s5'] },
    { id: 's5', label: 'All accounts\nbalanced?', type: 'decision', next: ['s6', 's7'] },
    { id: 's6', label: 'Management\nreview & topside\nadjustments', type: 'process', next: ['s8'] },
    { id: 's7', label: 'Investigate &\npost adjusting\njournal entries', type: 'process', next: ['s4'] },
    { id: 's8', label: 'Financial\nstatements\ngenerated', type: 'process', next: ['s9'] },
    { id: 's9', label: 'CFO sign-off\n& period closed', type: 'end' },
  ],
  'sop-005': [ // GL Reconciliation SOP - R2R
    { id: 's1', label: 'Month-end\ntrigger (T+1)', type: 'start', next: ['s2'] },
    { id: 's2', label: 'Extract GL trial\nbalance per entity', type: 'process', next: ['s3'] },
    { id: 's3', label: 'Auto-reconcile\nmatching entries\nacross subsidiaries', type: 'process', next: ['s4'] },
    { id: 's4', label: 'Variances\nexceed ₹50K\nthreshold?', type: 'decision', next: ['s5', 's6'] },
    { id: 's5', label: 'Flag & assign to\naccountant for\ninvestigation', type: 'process', next: ['s7'] },
    { id: 's6', label: 'Auto-certify\nreconciliation', type: 'process', next: ['s8'] },
    { id: 's7', label: 'Root cause\nidentified &\ncorrection posted?', type: 'decision', next: ['s6', 's9'] },
    { id: 's8', label: 'Manager sign-off\non reconciliation', type: 'process', next: ['s10'] },
    { id: 's9', label: 'Escalate to\nFinance Controller', type: 'process', next: ['s7'] },
    { id: 's10', label: 'Reconciliation\ncomplete &\narchived', type: 'end' },
  ],
};

// ─── SOP AI Recommendations ───
export const SOP_AI_RECOMMENDATIONS: Record<string, Array<{ type: 'improve' | 'add' | 'remove' | 'update'; text: string; impact: 'high' | 'medium' | 'low'; }>> = {
  'sop-001': [
    { type: 'add', text: 'Add automated vendor bank account verification step before payment release', impact: 'high' },
    { type: 'improve', text: 'Reduce three-way match tolerance from 5% to 2% for vendors with prior duplicates', impact: 'high' },
    { type: 'update', text: 'Update escalation matrix: current approval threshold (10L) has not been revised since FY24', impact: 'medium' },
  ],
  'sop-002': [
    { type: 'add', text: 'Include segregation of duties check between PO creator and approver', impact: 'high' },
    { type: 'improve', text: 'Add real-time budget utilization dashboard visibility during PO creation', impact: 'medium' },
  ],
  'sop-003': [
    { type: 'improve', text: 'Implement automated credit scoring refresh for repeat customers', impact: 'high' },
    { type: 'add', text: 'Add dispute resolution workflow for rejected invoices', impact: 'medium' },
  ],
  'sop-004': [
    { type: 'remove', text: 'Remove manual reconciliation step: automated sub-ledger reconciliation covers 98% of cases', impact: 'medium' },
    { type: 'update', text: 'Revise close timeline from T+5 to T+3 days per new corporate directive', impact: 'high' },
  ],
  'sop-005': [
    { type: 'add', text: 'Add inter-company elimination check for cross-subsidiary entries', impact: 'high' },
    { type: 'improve', text: 'Replace threshold-based variance detection with AI anomaly detection', impact: 'medium' },
  ],
};

// ─── Workflow Type Configurations (for unified canvas) ───
export type WorkflowTypeId = 'detection' | 'monitoring' | 'reconciliation' | 'compliance';

export interface WorkflowInputSource {
  id: string;
  name: string;
  type: string;
  format: string;
  fields: string[];
  frozen: boolean;
  frozenDate: string | null;
  records: string | null;
}

export interface WorkflowOutputColumn {
  id: string;
  name: string;
  type: 'text' | 'number' | 'badge' | 'percent';
  enabled: boolean;
  frozen: boolean;
}

export interface WorkflowPreviewRow {
  cells: string[];
  status: 'matched' | 'variance' | 'unmatched' | 'flagged' | 'ok' | 'warning';
}

export interface WorkflowTypeConfig {
  id: WorkflowTypeId;
  name: string;
  description: string;
  color: string;
  inputSources: WorkflowInputSource[];
  matchSettings: { toleranceDefault: string; logicOptions: string[]; defaultLogic: string };
  outputColumns: WorkflowOutputColumn[];
  layoutOptions: string[];
  previewStats: Array<{ label: string; value: string; color: string }>;
  previewRows: WorkflowPreviewRow[];
  kpiOptions: Array<{ id: string; label: string; enabled: boolean }>;
}

export const WORKFLOW_TYPE_CONFIGS: Record<WorkflowTypeId, WorkflowTypeConfig> = {
  detection: {
    id: 'detection',
    name: 'Duplicate Invoice Detection',
    description: 'Detect duplicate invoices across vendor payments',
    color: '#6a12cd',
    inputSources: [
      { id: 'invoices', name: 'Invoice Data', type: 'SAP ERP: AP Module', format: 'SQL', fields: ['Invoice Number', 'Vendor ID', 'Amount', 'Date', 'PO Reference'], frozen: false, frozenDate: null, records: null },
      { id: 'history', name: 'Historical Invoices', type: 'Invoice Archive', format: 'CSV', fields: ['Invoice Number', 'Vendor', 'Amount', 'Payment Date', 'Status'], frozen: false, frozenDate: null, records: null },
      { id: 'master', name: 'Vendor Master Data', type: 'System Reference', format: 'SQL', fields: ['Vendor ID', 'Name', 'Bank Account', 'Payment Terms', 'Status'], frozen: true, frozenDate: 'Mar 20, 2026', records: '892 vendors' },
    ],
    matchSettings: { toleranceDefault: '5%', logicOptions: ['Exact Match', 'Fuzzy Match', 'AI-Powered'], defaultLogic: 'Fuzzy Match' },
    outputColumns: [
      { id: 'invoice_no', name: 'Invoice Number', type: 'text', enabled: true, frozen: false },
      { id: 'vendor', name: 'Vendor', type: 'text', enabled: true, frozen: false },
      { id: 'amount', name: 'Amount', type: 'number', enabled: true, frozen: false },
      { id: 'original', name: 'Original Invoice', type: 'text', enabled: true, frozen: false },
      { id: 'match_score', name: 'Match Score', type: 'percent', enabled: true, frozen: true },
      { id: 'status', name: 'Status', type: 'badge', enabled: true, frozen: true },
      { id: 'action', name: 'Recommended Action', type: 'text', enabled: false, frozen: false },
    ],
    layoutOptions: ['Table', 'Dashboard', 'Split View'],
    previewStats: [
      { label: 'Records Scanned', value: '12,450', color: 'text-primary' },
      { label: 'Duplicates Found', value: '8', color: 'text-red-600' },
      { label: 'Amount at Risk', value: '\u20b96.16L', color: 'text-orange-600' },
      { label: 'Confidence', value: '94%', color: 'text-emerald-600' },
    ],
    previewRows: [
      { cells: ['INV-4521', 'Acme Corp', '\u20b945,200', 'INV-3102', '96%', 'Duplicate'], status: 'flagged' },
      { cells: ['INV-4533', 'Global Supplies', '\u20b91,28,750', 'INV-2987', '92%', 'Likely Duplicate'], status: 'warning' },
      { cells: ['INV-4558', 'TechVendor', '\u20b967,400', 'INV-3241', '88%', 'Review'], status: 'warning' },
      { cells: ['INV-4571', 'Acme Corp', '\u20b923,100', '\u2014', '12%', 'Clean'], status: 'ok' },
      { cells: ['INV-4589', 'Pinnacle', '\u20b989,600', 'INV-3012', '78%', 'Review'], status: 'warning' },
    ],
    kpiOptions: [
      { id: 'total_scanned', label: 'Total Records Scanned', enabled: true },
      { id: 'duplicates', label: 'Duplicates Found', enabled: true },
      { id: 'amount_risk', label: 'Amount at Risk', enabled: true },
      { id: 'run_comparison', label: 'Comparison vs Last Run', enabled: false },
      { id: 'trend', label: 'Duplicate Trend (30 days)', enabled: false },
    ],
  },
  reconciliation: {
    id: 'reconciliation',
    name: 'Three-Way PO Match',
    description: 'Match Purchase Orders, GRN, and Invoices',
    color: '#7c3aed',
    inputSources: [
      { id: 'po', name: 'Purchase Orders', type: 'SAP ERP Export', format: 'CSV', fields: ['PO Number', 'Vendor ID', 'Amount', 'Date', 'Currency'], frozen: false, frozenDate: null, records: null },
      { id: 'grn', name: 'Goods Receipt Notes', type: 'SAP ERP Export', format: 'CSV', fields: ['GRN Number', 'PO Reference', 'Quantity', 'Receipt Date', 'Warehouse'], frozen: false, frozenDate: null, records: null },
      { id: 'inv', name: 'Vendor Invoices', type: 'Upload / AP Module', format: 'PDF/CSV', fields: ['Invoice Number', 'Vendor', 'Amount', 'Due Date', 'Tax'], frozen: false, frozenDate: null, records: null },
      { id: 'master', name: 'Vendor Master Data', type: 'System Reference', format: 'SQL', fields: ['Vendor ID', 'Name', 'Bank Account', 'Payment Terms', 'Status'], frozen: true, frozenDate: 'Mar 20, 2026', records: '892 vendors' },
    ],
    matchSettings: { toleranceDefault: '5%', logicOptions: ['Exact Match', 'Fuzzy Match', 'AI-Powered'], defaultLogic: 'Fuzzy Match' },
    outputColumns: [
      { id: 'po_number', name: 'PO Number', type: 'text', enabled: true, frozen: false },
      { id: 'grn_ref', name: 'GRN Reference', type: 'text', enabled: true, frozen: false },
      { id: 'invoice_no', name: 'Invoice Number', type: 'text', enabled: true, frozen: false },
      { id: 'vendor', name: 'Vendor Name', type: 'text', enabled: true, frozen: false },
      { id: 'po_amount', name: 'PO Amount', type: 'number', enabled: true, frozen: false },
      { id: 'inv_amount', name: 'Invoice Amount', type: 'number', enabled: true, frozen: false },
      { id: 'variance', name: 'Variance', type: 'number', enabled: true, frozen: true },
      { id: 'match_status', name: 'Match Status', type: 'badge', enabled: true, frozen: true },
      { id: 'match_score', name: 'Match Score', type: 'percent', enabled: true, frozen: false },
    ],
    layoutOptions: ['Table', 'Dashboard', 'Split View'],
    previewStats: [
      { label: 'Total Records', value: '1,247', color: 'text-primary' },
      { label: 'Matched', value: '1,089 (87%)', color: 'text-emerald-600' },
      { label: 'Variance', value: '98 (8%)', color: 'text-amber-600' },
      { label: 'Unmatched', value: '60 (5%)', color: 'text-red-600' },
    ],
    previewRows: [
      { cells: ['PO-001', 'GRN-4521', 'INV-4521', 'Acme Corp', '\u20b945,200', '\u20b945,200', '\u20b90', 'Matched', '100%'], status: 'matched' },
      { cells: ['PO-002', 'GRN-4533', 'INV-4533', 'Global Supplies', '\u20b91,28,750', '\u20b91,31,200', '\u20b92,450', 'Variance', '96%'], status: 'variance' },
      { cells: ['PO-003', '\u2014', 'INV-4558', 'TechVendor', '\u20b967,400', '\u20b967,400', '\u2014', 'No GRN', '0%'], status: 'unmatched' },
      { cells: ['PO-004', 'GRN-4571', '\u2014', 'Acme Corp', '\u20b923,100', '\u2014', '\u2014', 'No Invoice', '0%'], status: 'unmatched' },
      { cells: ['PO-005', 'GRN-4589', 'INV-4589', 'Pinnacle', '\u20b989,600', '\u20b989,600', '\u20b90', 'Matched', '100%'], status: 'matched' },
    ],
    kpiOptions: [
      { id: 'total', label: 'Total Records Processed', enabled: true },
      { id: 'match_rate', label: 'Match Rate', enabled: true },
      { id: 'variance_amount', label: 'Total Variance Amount', enabled: true },
      { id: 'run_comparison', label: 'Comparison vs Last Run', enabled: false },
      { id: 'aging', label: 'Unmatched Aging Analysis', enabled: false },
    ],
  },
  monitoring: {
    id: 'monitoring',
    name: 'Vendor Master Change Monitor',
    description: 'Track unauthorized changes to vendor master data',
    color: '#0284c7',
    inputSources: [
      { id: 'changelog', name: 'Change Log', type: 'SAP Change Documents', format: 'SQL', fields: ['Change ID', 'Table', 'Field', 'Old Value', 'New Value', 'User', 'Timestamp'], frozen: false, frozenDate: null, records: null },
      { id: 'master', name: 'Vendor Master Data', type: 'System Reference', format: 'SQL', fields: ['Vendor ID', 'Name', 'Bank Account', 'Payment Terms', 'Status'], frozen: true, frozenDate: 'Mar 20, 2026', records: '892 vendors' },
      { id: 'auth', name: 'Authorization Matrix', type: 'HR/Access Module', format: 'CSV', fields: ['User ID', 'Role', 'Permissions', 'Department', 'Active'], frozen: true, frozenDate: 'Mar 15, 2026', records: '145 users' },
    ],
    matchSettings: { toleranceDefault: 'N/A', logicOptions: ['Rule-Based', 'AI Anomaly Detection', 'Threshold-Based'], defaultLogic: 'Rule-Based' },
    outputColumns: [
      { id: 'change_id', name: 'Change ID', type: 'text', enabled: true, frozen: false },
      { id: 'vendor', name: 'Vendor', type: 'text', enabled: true, frozen: false },
      { id: 'field', name: 'Changed Field', type: 'text', enabled: true, frozen: false },
      { id: 'old_value', name: 'Old Value', type: 'text', enabled: true, frozen: false },
      { id: 'new_value', name: 'New Value', type: 'text', enabled: true, frozen: false },
      { id: 'user', name: 'Changed By', type: 'text', enabled: true, frozen: false },
      { id: 'authorized', name: 'Authorized?', type: 'badge', enabled: true, frozen: true },
      { id: 'risk_level', name: 'Risk Level', type: 'badge', enabled: true, frozen: true },
    ],
    layoutOptions: ['Timeline', 'Table', 'Alert Dashboard'],
    previewStats: [
      { label: 'Changes Detected', value: '24', color: 'text-primary' },
      { label: 'Unauthorized', value: '3', color: 'text-red-600' },
      { label: 'High Risk', value: '5', color: 'text-orange-600' },
      { label: 'Auto-Approved', value: '16', color: 'text-emerald-600' },
    ],
    previewRows: [
      { cells: ['CHG-101', 'Acme Corp', 'Bank Account', 'HDFC-****1234', 'ICICI-****5678', 'admin_user', 'Unauthorized', 'High'], status: 'flagged' },
      { cells: ['CHG-102', 'Global Supplies', 'Payment Terms', 'Net 30', 'Net 60', 'ap_manager', 'Authorized', 'Low'], status: 'ok' },
      { cells: ['CHG-103', 'TechVendor', 'Bank Account', 'SBI-****9012', 'BOB-****3456', 'unknown_user', 'Unauthorized', 'High'], status: 'flagged' },
      { cells: ['CHG-104', 'Pinnacle', 'Address', '123 Main St', '456 Oak Ave', 'procurement', 'Authorized', 'Low'], status: 'ok' },
      { cells: ['CHG-105', 'Atlas Mfg', 'Status', 'Active', 'Blocked', 'compliance', 'Authorized', 'Medium'], status: 'warning' },
    ],
    kpiOptions: [
      { id: 'total_changes', label: 'Total Changes', enabled: true },
      { id: 'unauthorized', label: 'Unauthorized Changes', enabled: true },
      { id: 'response_time', label: 'Avg Response Time', enabled: false },
      { id: 'run_comparison', label: 'Comparison vs Last Run', enabled: false },
    ],
  },
  compliance: {
    id: 'compliance',
    name: 'SOD Violation Detector',
    description: 'Detect segregation of duties conflicts',
    color: '#7c3aed',
    inputSources: [
      { id: 'roles', name: 'Role Assignments', type: 'SAP GRC Module', format: 'SQL', fields: ['User ID', 'Role', 'Transaction Code', 'Authorization Object', 'Profile'], frozen: false, frozenDate: null, records: null },
      { id: 'matrix', name: 'SOD Rule Matrix', type: 'Compliance Config', format: 'CSV', fields: ['Rule ID', 'Conflict Pair', 'Risk Level', 'Business Process', 'Mitigation'], frozen: true, frozenDate: 'Mar 1, 2026', records: '156 rules' },
      { id: 'users', name: 'User Directory', type: 'HR Module', format: 'SQL', fields: ['User ID', 'Name', 'Department', 'Manager', 'Status'], frozen: true, frozenDate: 'Mar 18, 2026', records: '2,341 users' },
    ],
    matchSettings: { toleranceDefault: 'N/A', logicOptions: ['Rule-Based', 'AI Risk Scoring', 'Custom Matrix'], defaultLogic: 'Rule-Based' },
    outputColumns: [
      { id: 'user', name: 'User', type: 'text', enabled: true, frozen: false },
      { id: 'conflict', name: 'Conflict Pair', type: 'text', enabled: true, frozen: false },
      { id: 'roles', name: 'Conflicting Roles', type: 'text', enabled: true, frozen: false },
      { id: 'risk', name: 'Risk Level', type: 'badge', enabled: true, frozen: true },
      { id: 'process', name: 'Business Process', type: 'text', enabled: true, frozen: false },
      { id: 'mitigation', name: 'Mitigation', type: 'badge', enabled: true, frozen: true },
      { id: 'last_activity', name: 'Last Activity', type: 'text', enabled: false, frozen: false },
    ],
    layoutOptions: ['Risk Matrix', 'Table', 'Scorecard'],
    previewStats: [
      { label: 'Users Scanned', value: '2,341', color: 'text-primary' },
      { label: 'Violations', value: '12', color: 'text-red-600' },
      { label: 'High Risk', value: '4', color: 'text-orange-600' },
      { label: 'Mitigated', value: '8', color: 'text-emerald-600' },
    ],
    previewRows: [
      { cells: ['USR-042', 'Create PO + Approve PO', 'Purchaser, Approver', 'High', 'P2P', 'None'], status: 'flagged' },
      { cells: ['USR-078', 'Create Vendor + Pay Vendor', 'AP Clerk, AP Manager', 'High', 'P2P', 'Compensating'], status: 'warning' },
      { cells: ['USR-103', 'Post JE + Approve JE', 'Accountant, Supervisor', 'Medium', 'R2R', 'Dual Approval'], status: 'ok' },
      { cells: ['USR-156', 'Create PO + Receive Goods', 'Buyer, Warehouse', 'High', 'P2P', 'None'], status: 'flagged' },
      { cells: ['USR-201', 'Edit Master + Pay Vendor', 'Admin, AP Clerk', 'High', 'P2P', 'None'], status: 'flagged' },
    ],
    kpiOptions: [
      { id: 'users_scanned', label: 'Users Scanned', enabled: true },
      { id: 'violations', label: 'SOD Violations', enabled: true },
      { id: 'mitigated', label: 'Mitigated Controls', enabled: true },
      { id: 'run_comparison', label: 'Comparison vs Last Run', enabled: false },
      { id: 'trend', label: 'Violation Trend (quarterly)', enabled: false },
    ],
  },
};
