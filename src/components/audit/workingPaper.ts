/**
 * Control-testing export — multi-sheet .xlsx.
 *
 * A compliance engagement gets the standard ICFR working-paper layout and its
 * wording. An internal audit gets the same sheets under audit wording: it
 * issues a report, not a working paper, and it does not classify controls as
 * key or deficiencies as significant.
 *
 * Structure:
 *   1. Index            — cover: entity, scope, preparer/reviewer, conclusion, legend
 *   2. Control Summary  — one row per control (the RACM/summary sheet)
 *   3. Attribute Testing — one row per attribute (pass/fail detail)
 *   4. Exceptions       — failed attributes rolled into a deficiency log
 *
 * Built with SheetJS (already a project dependency, same as the ATR export).
 */
import * as XLSX from 'xlsx';
import type { Engagement } from '../../data/engagements';
import { attrCode } from '../../data/racm';

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
  /** The report format applied on the Audit Report tab. Printed on the cover
   *  sheet so the exported file says which format it was produced in. */
  reportFormat?: string;
}

function autofit(rows: (string | number)[][], max = 60): XLSX.ColInfo[] {
  const widths: number[] = [];
  rows.forEach(r => r.forEach((cell, i) => {
    const len = String(cell ?? '').length;
    widths[i] = Math.min(max, Math.max(widths[i] ?? 10, len + 2));
  }));
  return widths.map(wch => ({ wch }));
}

export function downloadWorkingPaper(engagement: Engagement, controls: WpControl[], meta: WpMeta): string {
  const isIA = engagement.type === 'Internal Audit';
  const wb = XLSX.utils.book_new();
  const allAttrs = controls.flatMap(c => c.attributes);
  const keyCount = controls.filter(c => c.isKey).length;
  const passC = controls.filter(c => c.status === 'Pass').length;
  const failC = controls.filter(c => c.status === 'Fail').length;
  const overall = failC > 0
    ? (isIA ? 'Exceptions noted — see the Exceptions sheet' : 'Exceptions noted — control deficiencies identified (see Exceptions sheet)')
    : controls.length > 0 && controls.every(c => c.status === 'Pass')
      ? (isIA ? 'Satisfactory — no exceptions noted' : 'Effective — no exceptions noted')
      : 'Testing in progress';

  // ── Sheet 1: Index / cover ──
  const indexRows: (string | number)[][] = [
    [isIA ? 'Internal Audit — Control Testing Report' : 'Internal Controls over Financial Reporting (ICFR) — Control Testing Working Paper'],
    [],
    ['Entity / Engagement', `${engagement.name} (${engagement.code})`],
    ['Framework', engagement.framework],
    ['Process', engagement.process],
    ['Testing period', `${engagement.periodStart} – ${engagement.periodEnd}`],
    [],
    ['Prepared by', meta.preparedBy],
    ['Reviewed by', meta.reviewedBy],
    ['Date', meta.preparedOn],
    ...(meta.reportFormat ? [['Report format', meta.reportFormat]] : []),
    [],
    ['— Scope —', ''],
    ['Controls in scope', controls.length],
    ...(isIA ? [] : [['Key controls', keyCount]]),
    ['Attributes tested', allAttrs.length],
    ['Controls — Pass', passC],
    ['Controls — Fail', failC],
    [],
    ['Overall conclusion', overall],
    [],
    ['— Legend —', ''],
    ['Result', 'Pass = no exceptions · Fail = exception(s) noted · Not tested = pending'],
    ['Test method', 'Automated = Pass/Fail from a workflow run · Self-assessed = owner attestation + evidence'],
    [isIA ? 'Report reference' : 'W/P reference', `${isIA ? 'IA' : 'WP'}-${engagement.code}`],
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
        // Significant / control deficiency is the ICFR severity ladder. An
        // internal audit rates a finding instead, the same words the Findings
        // tab uses.
        const severity = isIA ? (ctrl?.isKey ? 'High' : 'Medium') : (ctrl?.isKey ? 'Significant Deficiency' : 'Control Deficiency');
        return [a.controlId, a.attrId, a.remark || 'Exception noted during testing', isIA ? 'Control operation' : 'Operating effectiveness', severity, ctrl?.owner ?? engagement.owner, 'Open', 'Remediation pending — Action Taken Report raised'];
      })
    : [['—', '—', 'No exceptions noted in the tested population', '—', '—', '—', 'Closed', '—']];
  const exSheet = XLSX.utils.aoa_to_sheet([exHeader, ...exRows]);
  exSheet['!cols'] = autofit([exHeader, ...exRows]);
  XLSX.utils.book_append_sheet(wb, exSheet, 'Exceptions');

  const fileName = `${isIA ? 'Audit_Report' : 'Working_Paper'}_${engagement.code}.xlsx`;
  XLSX.writeFile(wb, fileName);
  return fileName;
}

// ─── Shared assembly (same seeds the Controls tab uses) ───────────────────────────

export type AttrType = 'Self-assessed' | 'Automated';
export type AttrResult = 'Not tested' | 'Pass' | 'Fail';

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic per-attribute result seed (mirrors ControlsTab). */
export function seedAttrResult(attributeId: string, engagementHealth: number): AttrResult {
  const r = hash(attributeId) % 100;
  if (engagementHealth === 0) return r < 82 ? 'Not tested' : r < 93 ? 'Pass' : 'Fail';
  const testedCut = Math.min(90, engagementHealth + 8);
  if (r >= testedCut) return 'Not tested';
  return r % 8 === 0 ? 'Fail' : 'Pass';
}

/** Default method: Automated if a workflow is linked, else a stable mix. */
export function seedAttrType(attributeId: string, hasWorkflow: boolean): AttrType {
  if (hasWorkflow) return 'Automated';
  return hash(`${attributeId}:type`) % 2 === 0 ? 'Automated' : 'Self-assessed';
}

export function rollupStatus(results: AttrResult[]): WpControl['status'] {
  const tested = results.filter(r => r !== 'Not tested');
  if (results.length === 0 || tested.length === 0) return 'Not tested';
  if (tested.length < results.length) return 'In test';
  return tested.some(r => r === 'Fail') ? 'Fail' : 'Pass';
}

function deriveCtrlType(methods: AttrType[]): string {
  const hasAuto = methods.includes('Automated');
  const hasSelf = methods.includes('Self-assessed');
  if (hasAuto && hasSelf) return 'Hybrid';
  return hasAuto ? 'Automated' : 'Self-assessed';
}

const SOX_ASSERTIONS = ['Completeness', 'Accuracy', 'Existence / Occurrence', 'Cut-off', 'Valuation', 'Rights & Obligations', 'Presentation'];

interface WsCtrlLike {
  controlId: string;
  description: string;
  subProcess: string;
  isKey: boolean;
  frequency: string;
  attributes: { id: string; description: string }[];
}

export interface WpBuildOpts {
  health: number;
  owner: string;
  testedOn: string;
  linkedWorkflows: (attrId: string) => { id: string; name: string }[];
  riskForControl: (controlId: string) => string | undefined;
  /** Optional live overrides (Controls tab passes these; the tab uses seeds). */
  method?: (attrId: string) => AttrType;
  result?: (attrId: string) => AttrResult;
  remark?: (attrId: string) => string;
}

/** Build the working-paper rows from engagement workspace controls. */
export function buildWpControls(controls: WsCtrlLike[], opts: WpBuildOpts): WpControl[] {
  return controls.map(c => {
    const attrs: WpAttribute[] = c.attributes.map(a => {
      const links = opts.linkedWorkflows(a.id);
      const method = opts.method?.(a.id) ?? seedAttrType(a.id, links.length > 0);
      const result = opts.result?.(a.id) ?? seedAttrResult(a.id, opts.health);
      const customRemark = (opts.remark?.(a.id) ?? '').trim();
      return {
        controlId: c.controlId,
        attrId: attrCode(a.id),
        description: a.description,
        assertion: SOX_ASSERTIONS[hash(a.id) % SOX_ASSERTIONS.length]!,
        method,
        workflow: method === 'Automated' ? (links.map(w => w.name).join(', ') || '—') : '—',
        result,
        remark: customRemark || (result === 'Fail' ? 'Exception noted during testing — see ATR' : ''),
        testedBy: result === 'Not tested' ? '—' : method === 'Automated' ? 'IRA · workflow' : opts.owner,
        testedOn: result === 'Not tested' ? '—' : opts.testedOn,
      };
    });
    return {
      controlId: c.controlId,
      description: c.description,
      risk: opts.riskForControl(c.controlId) ?? `Risk of error or fraud in ${c.subProcess}`,
      subProcess: c.subProcess,
      type: deriveCtrlType(attrs.map(a => a.method)),
      frequency: c.frequency,
      isKey: c.isKey,
      owner: opts.owner,
      status: rollupStatus(attrs.map(a => a.result)),
      attributes: attrs,
    };
  });
}

export interface WpSampling {
  population: number;
  method: string;
  samples: { ref: string; result: 'Pass' | 'Fail' }[];
}

/** One control's paper: Control cover + Attribute Testing (+ Sampling, + Exceptions
 *  if any). Returns the file name it wrote, so the caller's toast can name it. */
export function downloadControlWorkingPaper(engagement: Engagement, control: WpControl, meta: WpMeta, sampling?: WpSampling): string {
  const isIA = engagement.type === 'Internal Audit';
  const wb = XLSX.utils.book_new();
  const tested = control.attributes.filter(a => a.result !== 'Not tested').length;
  const pass = control.attributes.filter(a => a.result === 'Pass').length;
  const fail = control.attributes.filter(a => a.result === 'Fail').length;
  const conclusion = control.status === 'Pass' ? (isIA ? 'Satisfactory' : 'Effective')
    : control.status === 'Fail' ? (isIA ? 'Needs improvement' : 'Ineffective')
    : control.status === 'In test' ? 'In progress' : 'Not started';

  const coverRows: (string | number)[][] = [
    [isIA ? 'Internal Audit — Control Report' : 'Control Testing Working Paper'],
    [],
    ['Engagement', `${engagement.name} (${engagement.code})`],
    ['Framework', engagement.framework],
    ['Period', `${engagement.periodStart} – ${engagement.periodEnd}`],
    [],
    ['Control ID', control.controlId],
    ['Control', control.description],
    ['Risk', control.risk],
    ['Sub-process', control.subProcess],
    ['Type', control.type],
    ['Frequency', control.frequency],
    ...(isIA ? [] : [['Key control', control.isKey ? 'Yes' : 'No']]),
    ['Owner', control.owner],
  ];
  if (sampling) {
    coverRows.push(
      [],
      ['Population', sampling.population],
      ['Sample method', sampling.method],
      ['Sample size', sampling.samples.length],
      ['Samples passed', sampling.samples.filter(s => s.result === 'Pass').length],
    );
  }
  coverRows.push(
    [],
    ['Attributes', control.attributes.length],
    ['Tested', tested],
    ['Pass', pass],
    ['Fail', fail],
    ['Conclusion', conclusion],
    [],
    ['Prepared by', meta.preparedBy],
    ['Reviewed by', meta.reviewedBy],
    ['Date', meta.preparedOn],
    [isIA ? 'Report reference' : 'W/P reference', `${isIA ? 'IA' : 'WP'}-${control.controlId}`],
  );
  const cover = XLSX.utils.aoa_to_sheet(coverRows);
  cover['!cols'] = [{ wch: 16 }, { wch: 74 }];
  cover['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  XLSX.utils.book_append_sheet(wb, cover, 'Control');

  const attrHeader = ['Attribute ID', 'Attribute / Test Step', 'Assertion', 'Test Method', 'Linked Workflow', 'Result', 'Remark / Exception', 'Tested By', 'Date'];
  const attrRows: (string | number)[][] = control.attributes.map(a => [a.attrId, a.description, a.assertion, a.method, a.workflow, a.result, a.remark, a.testedBy, a.testedOn]);
  const attrSheet = XLSX.utils.aoa_to_sheet([attrHeader, ...attrRows]);
  attrSheet['!cols'] = autofit([attrHeader, ...attrRows]);
  XLSX.utils.book_append_sheet(wb, attrSheet, 'Attribute Testing');

  if (sampling && sampling.samples.length > 0) {
    const sHeader = ['Sample Ref', 'Result'];
    const sRows: (string | number)[][] = sampling.samples.map(s => [s.ref, s.result]);
    const sSheet = XLSX.utils.aoa_to_sheet([sHeader, ...sRows]);
    sSheet['!cols'] = autofit([sHeader, ...sRows]);
    XLSX.utils.book_append_sheet(wb, sSheet, 'Sampling');
  }

  const failed = control.attributes.filter(a => a.result === 'Fail');
  if (failed.length > 0) {
    const exHeader = ['Attribute ID', 'Exception', 'Severity', 'Owner', 'Status', 'Management Action'];
    const exRows: (string | number)[][] = failed.map(a => [a.attrId, a.remark || 'Exception noted', control.isKey ? 'Significant Deficiency' : 'Control Deficiency', control.owner, 'Open', 'Remediation pending — ATR raised']);
    const exSheet = XLSX.utils.aoa_to_sheet([exHeader, ...exRows]);
    exSheet['!cols'] = autofit([exHeader, ...exRows]);
    XLSX.utils.book_append_sheet(wb, exSheet, 'Exceptions');
  }

  const fileName = `${isIA ? 'Audit_Report' : 'Working_Paper'}_${control.controlId}.xlsx`;
  XLSX.writeFile(wb, fileName);
  return fileName;
}
