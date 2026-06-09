import * as XLSX from 'xlsx';
import type {
  AtrMeta,
  AtrObservation,
  AtrActionStatus,
  AtrObservationStatus,
  AtrClassification,
  AtrRisk,
} from './atrTypes';

// ─── The 9 required observation fields (drives template + parsing) ───
type FieldKey =
  | 'title' | 'description' | 'riskSummary' | 'recommendation'
  | 'evidence' | 'verification' | 'classification' | 'risk' | 'dueDate';

export interface AtrField {
  key: FieldKey;
  label: string;
  hint: string;
  example: string;
  /** Lowercase keywords used to fuzzy-match an uploaded sheet's header. */
  match: string[];
}

export const REQUIRED_FIELDS: AtrField[] = [
  { key: 'title',          label: 'Observation Title',                       hint: 'Short title of the observation.', example: 'Vendor Master Management', match: ['observation title', 'title'] },
  { key: 'description',     label: 'Observation Description',                 hint: 'What was observed / the issue.', example: '14 vendor codes activated in SAP without standard onboarding documentation.', match: ['description', 'issue', 'observation'] },
  { key: 'riskSummary',    label: 'Risk Summary',                            hint: 'The risk this exposes.', example: 'Unauthorized vendor creation could enable fictitious vendor fraud and duplicate payments.', match: ['risk summary'] },
  { key: 'recommendation', label: 'Recommendation / Action Plan',            hint: 'Management action / recommendation.', example: "Enforce a 'Maker-Checker' protocol for vendor onboarding in SAP.", match: ['recommendation', 'action plan', 'action'] },
  { key: 'evidence',       label: 'Evidence',                                hint: 'Evidence / supporting documents.', example: 'UAT report, SAP workflow diagram, sample of 3 newly activated vendors.', match: ['evidence'] },
  { key: 'verification',   label: 'Management Comments / Auditor Verification', hint: 'Checker / auditor verification or management comments.', example: 'Verified flow in SAP Production. Workflow functioning as expected.', match: ['verification', 'management comment', 'checker', 'auditor'] },
  { key: 'classification', label: 'Classification Status',                   hint: 'Design Deficiency | System Deficiency | Procedural Non-Compliance', example: 'System Deficiency', match: ['classification'] },
  { key: 'risk',           label: 'Risk Significance',                       hint: 'High | Medium | Low', example: 'High', match: ['risk significance', 'significance', 'severity'] },
  { key: 'dueDate',        label: 'Due Date / Timeline',                     hint: 'e.g. 30 Jun 2026', example: '20 Jun 2026', match: ['due date', 'timeline', 'due'] },
];

const EXCEL_FILENAME = 'ATR_Observations_Template.xlsx';
const WORD_FILENAME = 'ATR_Observations_Template.doc';

// ─── Normalisers ───
export function normaliseClassification(v?: string): AtrClassification | undefined {
  if (!v) return undefined;
  const s = v.toLowerCase();
  if (s.includes('design')) return 'Design Deficiency';
  if (s.includes('system')) return 'System Deficiency';
  if (s.includes('procedural') || s.includes('non-compliance') || s.includes('non compliance')) return 'Procedural Non-Compliance';
  return undefined;
}

export function normaliseRisk(v?: string): AtrRisk | undefined {
  if (!v) return undefined;
  const s = v.toLowerCase();
  if (s.includes('high')) return 'High';
  if (s.includes('med')) return 'Medium';
  if (s.includes('low')) return 'Low';
  return undefined;
}

function parseDueDate(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isPast(v?: string): boolean {
  const d = parseDueDate(v);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

// Derive an action-plan status from the verification text + due date.
export function deriveActionStatus(verification?: string, dueDate?: string): AtrActionStatus | undefined {
  const s = (verification ?? '').toLowerCase();
  if (s) {
    if (s.includes('overdue')) return 'Overdue';
    if (s.includes('partial') || s.includes('pending uat')) return 'Partially Implemented';
    if (/implemented|verified|closed|accepted|complete|done/.test(s)) return 'Implemented';
    if (/pending|awaited|await|not started|not yet|under review|draft|open/.test(s)) return 'Pending';
  }
  if (isPast(dueDate)) return 'Overdue';
  if (s || dueDate) return 'Pending';
  return undefined;
}

// Derive the observation status from its action plans.
export function deriveObservationStatus(obs: AtrObservation): AtrObservationStatus | undefined {
  const statuses = obs.actionPlans.map(p => p.status).filter(Boolean) as AtrActionStatus[];
  if (statuses.length === 0) return undefined;
  if (statuses.some(s => s === 'Overdue')) return 'Overdue';
  if (statuses.every(s => s === 'Implemented')) return 'Closed';
  if (statuses.every(s => s === 'Pending' || s === 'Not Due')) return 'Open';
  return 'In Progress';
}

// ─── Executive-summary roll-up (computed purely from the observations) ───
export interface AtrExecSummary {
  totalObservations: number;
  totalActionPlans: number;
  overdue: number;
  classification: Record<AtrClassification, number>;
  risk: Record<AtrRisk, number>;
  obsStatus: Record<AtrObservationStatus, number>;
  actionStatus: Record<AtrActionStatus, number>;
  hasProcess: boolean;
  progressPct: number | null;
}

export function computeExecSummary(observations: AtrObservation[]): AtrExecSummary {
  const classification: Record<AtrClassification, number> = { 'Design Deficiency': 0, 'System Deficiency': 0, 'Procedural Non-Compliance': 0 };
  const risk: Record<AtrRisk, number> = { High: 0, Medium: 0, Low: 0 };
  const obsStatus: Record<AtrObservationStatus, number> = { Closed: 0, 'In Progress': 0, Open: 0, Overdue: 0 };
  const actionStatus: Record<AtrActionStatus, number> = { Implemented: 0, 'Partially Implemented': 0, Pending: 0, Overdue: 0, 'Not Due': 0 };
  let totalActionPlans = 0;
  let overdue = 0;
  let hasProcess = false;

  observations.forEach(o => {
    if (o.classification) classification[o.classification] += 1;
    if (o.risk) risk[o.risk] += 1;
    if (o.status) obsStatus[o.status] += 1;
    if (o.process) hasProcess = true;
    if (o.status === 'Overdue') overdue += 1;
    o.actionPlans.forEach(p => {
      totalActionPlans += 1;
      if (p.status) actionStatus[p.status] += 1;
    });
  });

  const implemented = actionStatus.Implemented + 0.5 * actionStatus['Partially Implemented'];
  const progressPct = totalActionPlans > 0 ? Math.round((implemented / totalActionPlans) * 100) : null;

  return { totalObservations: observations.length, totalActionPlans, overdue, classification, risk, obsStatus, actionStatus, hasProcess, progressPct };
}

// ─── Template downloads ───
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadExcelTemplate() {
  const headers = REQUIRED_FIELDS.map(f => f.label);
  const example = REQUIRED_FIELDS.map(f => f.example);
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws['!cols'] = headers.map(() => ({ wch: 30 }));

  const instr = XLSX.utils.aoa_to_sheet([
    ['Field', 'Required', 'Guidance / allowed values'],
    ...REQUIRED_FIELDS.map(f => [f.label, 'Yes', f.hint]),
    [],
    ['Tip', '', 'Add one row per observation in the "Observations" sheet. The example row can be edited or deleted.'],
  ]);
  instr['!cols'] = [{ wch: 38 }, { wch: 10 }, { wch: 64 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Observations');
  XLSX.utils.book_append_sheet(wb, instr, 'Instructions');
  XLSX.writeFile(wb, EXCEL_FILENAME);
}

export function downloadWordTemplate() {
  const rows = REQUIRED_FIELDS.map(
    f => `<tr><td style="width:34%;background:#F7F0FF;font-weight:bold;padding:8px;border:1px solid #DCBBFD;">${f.label}</td><td style="padding:8px;border:1px solid #DCBBFD;color:#6B5D82;">${f.hint}</td></tr>`,
  ).join('');
  const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>ATR Observations Template</title></head>
  <body style="font-family:Calibri,Arial,sans-serif;color:#0F0720;">
    <h2 style="color:#6A12CD;">Action Taken Report — Observation Template</h2>
    <p>Fill one table per observation. Replace the guidance text with your details and duplicate the table below for each additional observation.</p>
    <table cellspacing="0" style="border-collapse:collapse;width:100%;font-size:11pt;">${rows}</table>
    <p style="color:#9A8FAE;font-size:9pt;margin-top:16px;">Classification Status: Design Deficiency · System Deficiency · Procedural Non-Compliance &nbsp;|&nbsp; Risk Significance: High · Medium · Low</p>
  </body></html>`;
  triggerDownload(new Blob(['﻿', html], { type: 'application/msword' }), WORD_FILENAME);
}

// ─── Export the generated ATR back out (real Excel / Word) ───
function obsRows(meta: AtrMeta, observations: AtrObservation[]) {
  const rows: Record<string, string>[] = [];
  observations.forEach(o => {
    const plans = o.actionPlans.length ? o.actionPlans : [{ text: '' } as AtrObservation['actionPlans'][number]];
    plans.forEach((p, i) => {
      rows.push({
        'Observation Title': o.title,
        'Observation Description': i === 0 ? (o.description ?? '') : '',
        'Risk Summary': i === 0 ? (o.riskSummary ?? '') : '',
        'Recommendation / Action Plan': p.text ?? '',
        'Evidence': p.evidence ?? '',
        'Management Comments / Auditor Verification': p.verification ?? '',
        'Classification Status': i === 0 ? (o.classification ?? '') : '',
        'Risk Significance': i === 0 ? (o.risk ?? '') : '',
        'Due Date / Timeline': p.dueDate ?? '',
        'Status': p.status ?? '',
      });
    });
  });
  return { rows, meta };
}

export function exportAtrExcel(meta: AtrMeta, observations: AtrObservation[]) {
  const { rows } = obsRows(meta, observations);
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Object.keys(rows[0] ?? { a: 1 }).map(() => ({ wch: 30 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Observations');
  XLSX.writeFile(wb, `${meta.reportId || 'ATR'}.xlsx`);
}

export function exportAtrWord(meta: AtrMeta, observations: AtrObservation[]) {
  const esc = (s?: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const blocks = observations.map((o, i) => {
    const plans = o.actionPlans.map((p, j) => `
      <p style="margin:6px 0 2px;"><b>Action Plan ${j + 1}</b>${p.dueDate ? ` — Due ${esc(p.dueDate)}` : ''}${p.status ? ` (${esc(p.status)})` : ''}</p>
      <p style="margin:0 0 2px;">${esc(p.text)}</p>
      ${p.evidence ? `<p style="margin:0 0 2px;color:#6B5D82;"><i>Evidence / Comments:</i> ${esc(p.evidence)}</p>` : ''}
      ${p.verification ? `<p style="margin:0 0 8px;"><i>Checker / Auditor Verification:</i> ${esc(p.verification)}</p>` : ''}`).join('');
    return `
      <h3 style="color:#550FA5;margin:16px 0 4px;">${i + 1}. ${esc(o.title)}${o.process ? ` — ${esc(o.process)}` : ''}</h3>
      <p style="margin:0;color:#6B5D82;">${[o.risk && `${o.risk} Risk`, o.classification, o.status].filter(Boolean).map(esc).join(' · ')}</p>
      ${o.description ? `<p style="margin:6px 0 2px;"><b>Issue:</b> ${esc(o.description)}</p>` : ''}
      ${o.riskSummary ? `<p style="margin:0 0 2px;"><b>Risk Summary:</b> ${esc(o.riskSummary)}</p>` : ''}
      ${plans}`;
  }).join('');
  const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(meta.reportId)}</title></head>
  <body style="font-family:Calibri,Arial,sans-serif;color:#0F0720;">
    <h1 style="color:#6A12CD;margin-bottom:0;">Action Taken Report</h1>
    <p style="color:#6B5D82;margin-top:4px;">${[meta.auditEntity, meta.auditPeriod].filter(Boolean).map(esc).join(' · ')}</p>
    <p style="font-size:10pt;color:#6B5D82;">Report ID: ${esc(meta.reportId)}${meta.auditTitle ? ` · ${esc(meta.auditTitle)}` : ''}${meta.preparedBy ? ` · Prepared by ${esc(meta.preparedBy)}` : ''}${meta.generatedOn ? ` · ${esc(meta.generatedOn)}` : ''}</p>
    <hr/>${blocks}
  </body></html>`;
  triggerDownload(new Blob(['﻿', html], { type: 'application/msword' }), `${meta.reportId || 'ATR'}.doc`);
}

// ─── Parse an uploaded file into observations ───
// Returns the parsed observations for .xlsx/.xls/.csv, or null for file types
// the browser can't read (caller falls back to the sample data).
export async function parseObservationsFromFile(file: File): Promise<AtrObservation[] | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!['xlsx', 'xls', 'csv'].includes(ext)) return null;
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheetName = wb.SheetNames.find(n => /observation/i.test(n)) ?? wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    if (!sheet) return [];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false, defval: '' });
    if (rows.length === 0) return [];

    // Map each header in the sheet to one of our field keys.
    const headerKeys = Object.keys(rows[0]);
    const colFor: Partial<Record<FieldKey, string>> = {};
    REQUIRED_FIELDS.forEach(f => {
      const hit = headerKeys.find(h => f.match.some(m => h.toLowerCase().includes(m)));
      if (hit) colFor[f.key] = hit;
    });

    const val = (row: Record<string, unknown>, key: FieldKey) => {
      const col = colFor[key];
      const raw = col ? row[col] : '';
      return String(raw ?? '').trim();
    };

    const observations: AtrObservation[] = [];
    rows.forEach(row => {
      const title = val(row, 'title');
      const recommendation = val(row, 'recommendation');
      if (!title && !recommendation) return; // skip empty rows
      const dueDate = val(row, 'dueDate') || undefined;
      const verification = val(row, 'verification') || undefined;
      const risk = normaliseRisk(val(row, 'risk'));
      const obs: AtrObservation = {
        title: title || 'Untitled Observation',
        description: val(row, 'description') || undefined,
        riskSummary: val(row, 'riskSummary') || undefined,
        classification: normaliseClassification(val(row, 'classification')),
        risk,
        actionPlans: recommendation
          ? [{
              text: recommendation,
              dueDate,
              priority: risk,
              evidence: val(row, 'evidence') || undefined,
              verification,
              status: deriveActionStatus(verification, dueDate),
            }]
          : [],
      };
      obs.status = deriveObservationStatus(obs);
      observations.push(obs);
    });
    return observations;
  } catch {
    return null;
  }
}

// ─── Sample observations (simulated extraction for PDF/Word uploads) ───
// Sourced from ATR_Comprehensive_Sample.pdf so the format demos fully.
export const SAMPLE_OBSERVATIONS: AtrObservation[] = [
  {
    title: 'Vendor Master Management',
    process: 'Procurement (P2P)',
    risk: 'High',
    status: 'Closed',
    classification: 'System Deficiency',
    description: 'During the review period, 14 vendor codes were activated in SAP without the standard onboarding documentation (PAN, GST, MSME declaration, bank letter). Of these, 6 were used for transactions exceeding ₹15 lakhs aggregate.',
    querySummary: 'Review of vendor creation and approval workflows in SAP.',
    riskSummary: 'Unauthorized vendor creation could enable fictitious vendor fraud, duplicate payments, and PMLA non-compliance.',
    actionPlans: [
      { text: "Configure mandatory dual-factor authentication (2FA) via RSA tokens for all users with SAP 'Vendor Master' creation or modification rights.", dueDate: '15 May 2026', priority: 'High', status: 'Implemented', evidence: 'Security audit logs, configuration screenshots of SAP 2FA module, and signed monthly user access review report (April 2026).', verification: 'Verified in SAP on 25 Apr 2026 — 2FA active for all 18 users with M_LFA1_BUK authorization. Accepted.' },
      { text: "Redesign the vendor onboarding workflow in SAP to enforce a strict 'Maker-Checker' protocol. No vendor profile can be activated without second-level validation.", dueDate: '20 Jun 2026', priority: 'Medium', status: 'Implemented', evidence: 'UAT report, workflow diagram in SAP, and sample of 3 newly activated vendors.', verification: 'Verified flow in SAP Production environment. Workflow functioning as expected.' },
      { text: 'Establish a centralised Vendor Onboarding Portal to capture all statutory documents digitally with automated validation against MCA / GST databases.', dueDate: '30 Jul 2026', priority: 'High', status: 'Partially Implemented', evidence: 'Portal login credentials for testing, system user manual, and API integration evidence with MCA / GSTN.', verification: 'Verified end-to-end portal workflow. GST API integration validates credentials; MCA integration pending UAT scheduled for Jun 2026.' },
    ],
  },
  {
    title: 'Three-Way Match Bypass in Procurement',
    process: 'Procurement (P2P)',
    risk: 'Medium',
    status: 'In Progress',
    classification: 'Procedural Non-Compliance',
    description: 'In 23 of 4,217 sampled invoices, payments were released despite tolerance exceptions in 3-way match (PO ↔ GRN ↔ Invoice). MIRO bypass override was used by 4 users without documented justification.',
    querySummary: 'Assessment of PO / GRN / Invoice matching controls and tolerance override usage in SAP MM.',
    riskSummary: 'Bypass of 3-way match controls weakens accuracy of vendor payouts and may result in payment for goods not received or at incorrect rates.',
    actionPlans: [
      { text: 'Tighten OMR1 tolerance limits and remove tolerance override authority from non-Finance Manager roles.', dueDate: '10 May 2026', priority: 'High', status: 'Implemented', evidence: 'OMR1 configuration screenshots, updated SU01 role assignments, and approval email from CFO dated 28 Apr 2026.', verification: 'Verified — tolerance limits revised, only 2 Finance Manager users retain override. Test transactions confirm block on others.' },
      { text: 'Implement a monthly exception report from SAP for all MIRO override transactions, reviewed and signed by the Finance Controller.', dueDate: '30 Jun 2026', priority: 'Medium', status: 'Pending', evidence: 'Draft SAP query (SQ01) shared; report design under review. To be operationalised from May 2026 cycle.', verification: 'Pending — first signed exception report awaited. Will re-verify in Q4 follow-up.' },
    ],
  },
  {
    title: 'Freight Rate Approval Gap',
    process: 'Dispatch & Logistics',
    risk: 'High',
    status: 'Overdue',
    classification: 'Design Deficiency',
    description: 'In September 2024, 2 dispatch lots (DL-0917 and DL-0928) were released to transporters without prior freight rate approval in SAP. Rates were back-dated and approved post-dispatch, creating a control gap of ₹4.7 lakh.',
    querySummary: 'Validation of pre-dispatch freight rate approval workflow and contract-rate vs actual-rate variance.',
    riskSummary: 'Post-facto rate approval undermines the integrity of dispatch authorisation and exposes the company to inflated freight outflow.',
    actionPlans: [
      { text: 'Configure a hard block in the SAP logistics module preventing dispatch document creation (VL01N) unless an approved freight rate exists in the contract master (TK11).', dueDate: '30 Apr 2026', priority: 'High', status: 'Overdue', evidence: 'Functional spec drafted; user-exit development assigned to internal SAP team. Go-live slipped from 30 Apr to mid-June.', verification: 'OVERDUE — control still not enforced. Escalated to Audit Committee on 12 May 2026. Revised target: 15 Jun 2026.' },
      { text: 'Introduce a pre-dispatch logistics checklist with mandatory rate-approval reference number capture before gate-out.', dueDate: '30 Jun 2026', priority: 'Medium', status: 'Pending', evidence: 'Checklist template circulated to plant-head; field rollout scheduled with monthly compliance KPI tracking.', verification: 'Awaiting first month of rollout data — verification deferred to Q4 review.' },
    ],
  },
  {
    title: 'Physical vs Book Stock Variance — Cement Bags',
    process: 'Inventory Management',
    risk: 'Medium',
    status: 'Open',
    classification: 'Procedural Non-Compliance',
    description: 'Quarterly physical verification of finished-goods (PPC 50kg cement bags) at Plant-2 showed a negative variance of 1,840 bags valued at ₹6.4 lakh. Variance was not investigated within the SOP-mandated 7 working days.',
    querySummary: 'Review of stock-take variance recording, root-cause analysis, and write-off approvals.',
    riskSummary: 'Uninvestigated stock variances may conceal pilferage or system mis-postings and distort FG inventory in financial statements.',
    actionPlans: [
      { text: 'Introduce a mandatory 7-day variance investigation tracker with auto-escalation to Plant Head and Finance Controller for variances above ₹1 lakh.', dueDate: '25 May 2026', priority: 'High', status: 'Pending', evidence: 'SOP draft circulated; awaiting Plant Head sign-off. Tracker to be hosted on internal SharePoint.', verification: 'Open — implementation not yet started. Will follow up in next cycle.' },
    ],
  },
  {
    title: 'Scrap Sale Approval & Reconciliation',
    process: 'Inventory Management',
    risk: 'Low',
    status: 'Closed',
    classification: 'System Deficiency',
    description: 'Sample testing of 8 scrap-sale instances showed 3 cases where the approved minimum scrap rate and gate-pass quantity were not reconciled to invoice / receipt. Net under-recovery: ₹1.2 lakh.',
    querySummary: 'Assessment of scrap disposal authorisation, rate-setting committee minutes, and gate-pass to invoice reconciliation.',
    riskSummary: 'Inadequate scrap reconciliation can lead to revenue leakage and provides opportunity for unrecorded cash collections at the plant gate.',
    actionPlans: [
      { text: 'Activate the SAP Scrap Sale module with mandatory gate-pass quantity capture, minimum rate validation, and end-of-month reconciliation report.', dueDate: '30 Apr 2026', priority: 'Medium', status: 'Implemented', evidence: 'SAP module configuration evidence, signed reconciliation reports for Feb–Apr 2026, and committee minutes.', verification: 'Verified — full reconciliation for 3 consecutive months reviewed. No variance noted. Closed.' },
      { text: 'Mandate quarterly rotation of the Scrap Rate Committee members to reduce concentration risk.', dueDate: '30 Apr 2026', priority: 'Low', status: 'Implemented', evidence: 'Updated committee charter, HR communication, and Q1 FY26 committee composition.', verification: 'Verified — rotation effected for Q1 FY26. Closed.' },
    ],
  },
];

// Key insights for the sample (auditor commentary — only shown when provided).
export const SAMPLE_INSIGHTS = [
  { title: 'Strong management commitment on system-led controls', body: 'Two of the five observations (Vendor Master and Scrap Sale) are fully closed with both technical and procedural controls in place. Management has demonstrated good responsiveness on SAP-led changes.' },
  { title: 'Freight rate approval gap requires Audit Committee attention', body: 'Observation 3 (Freight Rate Approval Gap) is now overdue. The hard block in VL01N has not yet been deployed despite a 30 Apr 2026 deadline. Recommend a fixed go-live of 15 Jun 2026 with weekly status to the Audit Committee.' },
  { title: 'Variance investigation cadence needs strengthening', body: 'Observation 4 (FG stock variance) remains open. The 7-day variance investigation SOP should be operationalised before the next physical verification cycle to prevent recurrence.' },
  { title: 'Recommended follow-up', body: 'A follow-up review is recommended in Q4 FY 2024-25 to verify completion of in-progress / pending items and validate sustained operation of implemented controls.' },
];
