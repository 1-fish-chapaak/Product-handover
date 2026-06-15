/**
 * SOX / ICFR control-testing working paper — multi-sheet .xlsx export.
 *
 * Structure (standard ICFR W/P layout):
 *   1. Index            — cover: entity, scope, preparer/reviewer, conclusion, legend
 *   2. Control Summary  — one row per control (the RACM/summary sheet)
 *   3. Attribute Testing — one row per attribute (pass/fail detail)
 *   4. Exceptions       — failed attributes rolled into a deficiency log
 *
 * Built with SheetJS (already a project dependency, same as the ATR export).
 */
import * as XLSX from 'xlsx';
import type { Engagement } from '../../data/engagements';

export interface WpAttribute {
  controlId: string;
  attrId: string;
  description: string;
  assertion: string;
  method: 'Self-assessed' | 'Automated';
  workflow: string;
  result: 'Not tested' | 'Pass' | 'Fail';
  remark: string;
  testedBy: string;
  testedOn: string;
}

export interface WpControl {
  controlId: string;
  description: string;
  risk: string;
  subProcess: string;
  type: string; // Automated / Self-assessed / Hybrid
  frequency: string;
  isKey: boolean;
  owner: string;
  status: 'Not tested' | 'In test' | 'Pass' | 'Fail';
  attributes: WpAttribute[];
}

export interface WpMeta {
  preparedBy: string;
  reviewedBy: string;
  preparedOn: string;
}

function autofit(rows: (string | number)[][], max = 60): XLSX.ColInfo[] {
  const widths: number[] = [];
  rows.forEach(r => r.forEach((cell, i) => {
    const len = String(cell ?? '').length;
    widths[i] = Math.min(max, Math.max(widths[i] ?? 10, len + 2));
  }));
  return widths.map(wch => ({ wch }));
}

export function downloadWorkingPaper(engagement: Engagement, controls: WpControl[], meta: WpMeta): void {
  const wb = XLSX.utils.book_new();
  const allAttrs = controls.flatMap(c => c.attributes);
  const keyCount = controls.filter(c => c.isKey).length;
  const passC = controls.filter(c => c.status === 'Pass').length;
  const failC = controls.filter(c => c.status === 'Fail').length;
  const overall = failC > 0
    ? 'Exceptions noted — control deficiencies identified (see Exceptions sheet)'
    : controls.length > 0 && controls.every(c => c.status === 'Pass')
      ? 'Effective — no exceptions noted'
      : 'Testing in progress';

  // ── Sheet 1: Index / cover ──
  const indexRows: (string | number)[][] = [
    ['Internal Controls over Financial Reporting (ICFR) — Control Testing Working Paper'],
    [],
    ['Entity / Engagement', `${engagement.name} (${engagement.code})`],
    ['Framework', engagement.framework],
    ['Process', engagement.process],
    ['Testing period', `${engagement.periodStart} – ${engagement.periodEnd}`],
    [],
    ['Prepared by', meta.preparedBy],
    ['Reviewed by', meta.reviewedBy],
    ['Date', meta.preparedOn],
    [],
    ['— Scope —', ''],
    ['Controls in scope', controls.length],
    ['Key controls', keyCount],
    ['Attributes tested', allAttrs.length],
    ['Controls — Pass', passC],
    ['Controls — Fail', failC],
    [],
    ['Overall conclusion', overall],
    [],
    ['— Legend —', ''],
    ['Result', 'Pass = no exceptions · Fail = exception(s) noted · Not tested = pending'],
    ['Test method', 'Automated = Pass/Fail from a workflow run · Self-assessed = owner attestation + evidence'],
    ['W/P reference', `WP-${engagement.code}`],
  ];
  const index = XLSX.utils.aoa_to_sheet(indexRows);
  index['!cols'] = [{ wch: 26 }, { wch: 78 }];
  index['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  XLSX.utils.book_append_sheet(wb, index, 'Index');

  // ── Sheet 2: Control Summary ──
  const sumHeader = ['W/P Ref', 'Control ID', 'Control Description', 'Risk', 'Sub-process', 'Type', 'Frequency', 'Key', 'Owner', 'Attributes', 'Tested', 'Pass', 'Fail', 'Conclusion'];
  const sumRows: (string | number)[][] = controls.map(c => {
    const tested = c.attributes.filter(a => a.result !== 'Not tested').length;
    const p = c.attributes.filter(a => a.result === 'Pass').length;
    const f = c.attributes.filter(a => a.result === 'Fail').length;
    const conclusion = c.status === 'Pass' ? 'Effective' : c.status === 'Fail' ? 'Ineffective' : c.status === 'In test' ? 'In progress' : 'Not started';
    return [`WP-${c.controlId}`, c.controlId, c.description, c.risk, c.subProcess, c.type, c.frequency, c.isKey ? 'Yes' : 'No', c.owner, c.attributes.length, tested, p, f, conclusion];
  });
  const summary = XLSX.utils.aoa_to_sheet([sumHeader, ...sumRows]);
  summary['!cols'] = autofit([sumHeader, ...sumRows]);
  summary['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: sumRows.length, c: sumHeader.length - 1 } }) };
  XLSX.utils.book_append_sheet(wb, summary, 'Control Summary');

  // ── Sheet 3: Attribute Testing ──
  const attrHeader = ['Control ID', 'Attribute ID', 'Attribute / Test Step', 'Assertion', 'Test Method', 'Linked Workflow', 'Result', 'Remark / Exception', 'Tested By', 'Date'];
  const attrRows: (string | number)[][] = allAttrs.map(a => [a.controlId, a.attrId, a.description, a.assertion, a.method, a.workflow, a.result, a.remark, a.testedBy, a.testedOn]);
  const attrSheet = XLSX.utils.aoa_to_sheet([attrHeader, ...attrRows]);
  attrSheet['!cols'] = autofit([attrHeader, ...attrRows]);
  attrSheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: attrRows.length, c: attrHeader.length - 1 } }) };
  XLSX.utils.book_append_sheet(wb, attrSheet, 'Attribute Testing');

  // ── Sheet 4: Exceptions & Deficiencies ──
  const exHeader = ['Control ID', 'Attribute ID', 'Exception', 'Classification', 'Severity', 'Owner', 'Status', 'Management Action'];
  const failed = allAttrs.filter(a => a.result === 'Fail');
  const exRows: (string | number)[][] = failed.length > 0
    ? failed.map(a => {
        const ctrl = controls.find(c => c.controlId === a.controlId);
        const severity = ctrl?.isKey ? 'Significant Deficiency' : 'Control Deficiency';
        return [a.controlId, a.attrId, a.remark || 'Exception noted during testing', 'Operating effectiveness', severity, ctrl?.owner ?? engagement.owner, 'Open', 'Remediation pending — Action Taken Report raised'];
      })
    : [['—', '—', 'No exceptions noted in the tested population', '—', '—', '—', 'Closed', '—']];
  const exSheet = XLSX.utils.aoa_to_sheet([exHeader, ...exRows]);
  exSheet['!cols'] = autofit([exHeader, ...exRows]);
  XLSX.utils.book_append_sheet(wb, exSheet, 'Exceptions');

  XLSX.writeFile(wb, `Working_Paper_${engagement.code}.xlsx`);
}
