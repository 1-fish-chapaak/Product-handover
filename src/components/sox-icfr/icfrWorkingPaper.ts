import * as XLSX from 'xlsx';
import { controlConclusion, severityOf } from './helpers';
import type { Control, IcfrEngagement } from './types';

function autofit(rows: (string | number)[][], max = 60): XLSX.ColInfo[] {
  const w: number[] = [];
  rows.forEach(r => r.forEach((c, i) => { w[i] = Math.min(max, Math.max(w[i] ?? 10, String(c ?? '').length + 2)); }));
  return w.map(wch => ({ wch }));
}
function todRollup(c: Control): string {
  if (c.attributes.some(a => a.tod.result === 'Fail')) return 'Fail';
  if (c.attributes.every(a => a.tod.result === 'Pass')) return 'Pass';
  return 'Not tested';
}
function toeRollup(c: Control): string {
  if (c.attributes.some(a => a.toe.result === 'Fail')) return 'Fail';
  if (c.attributes.every(a => a.toe.result === 'Pass')) return 'Pass';
  return 'Not tested';
}

/** Consolidated ICFR working paper: Index · Control Summary · Attribute Testing · Deficiencies · Scope. */
export function downloadIcfrWorkingPaper(eng: IcfrEngagement): void {
  const wb = XLSX.utils.book_new();
  const concl = eng.controls.map(controlConclusion);
  const overall = concl.includes('Ineffective')
    ? 'Deficiencies identified — see Deficiencies sheet'
    : concl.length && concl.every(c => c === 'Effective') ? 'Effective — no exceptions' : 'Testing in progress';

  const index: (string | number)[][] = [
    ['Internal Control over Financial Reporting (ICFR) — Working Paper'],
    [],
    ['Entity', eng.entity],
    ['Engagement', `${eng.name} (${eng.code})`],
    ['Framework', eng.framework],
    ['Period', `${eng.periodStart} – ${eng.periodEnd} · ${eng.period}`],
    ['Overall materiality', eng.materiality],
    ['Performance materiality', eng.performanceMateriality],
    [],
    ['Prepared by', eng.preparer],
    ['Reviewed by', eng.reviewer],
    [],
    ['Controls in scope', eng.controls.length],
    ['Key controls', eng.controls.filter(c => c.isKey).length],
    ['Effective', concl.filter(c => c === 'Effective').length],
    ['Ineffective', concl.filter(c => c === 'Ineffective').length],
    ['Deficiencies', eng.deficiencies.length],
    [],
    ['Overall conclusion', overall],
    [],
    ['Legend', 'TOD = Test of Design · TOE = Test of Operating Effectiveness · severity = likelihood × magnitude vs materiality'],
  ];
  const ix = XLSX.utils.aoa_to_sheet(index);
  ix['!cols'] = [{ wch: 26 }, { wch: 70 }];
  ix['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  XLSX.utils.book_append_sheet(wb, ix, 'Index');

  const sumH = ['Control ID', 'Description', 'Nature', 'Type', 'Frequency', 'Key', 'Owner', 'Assertions', 'TOD', 'TOE', 'Conclusion'];
  const sumR: (string | number)[][] = eng.controls.map(c => [c.id, c.description, c.nature, c.type, c.frequency, c.isKey ? 'Yes' : 'No', c.owner, c.assertions.join('; '), todRollup(c), toeRollup(c), controlConclusion(c)]);
  const sum = XLSX.utils.aoa_to_sheet([sumH, ...sumR]); sum['!cols'] = autofit([sumH, ...sumR]);
  XLSX.utils.book_append_sheet(wb, sum, 'Control Summary');

  const atH = ['Control ID', 'Attribute', 'Description', 'Assertion', 'Precision', 'TOD', 'TOD note', 'TOE', 'TOE procedures', 'TOE note', 'Tested by'];
  const atR: (string | number)[][] = eng.controls.flatMap(c => c.attributes.map(a => [c.id, a.code, a.description, a.assertion, a.precision, a.tod.result, a.tod.note, a.toe.result, a.toe.procedures.join('; '), a.toe.note, a.toe.testedBy ?? a.tod.testedBy ?? '—']));
  const at = XLSX.utils.aoa_to_sheet([atH, ...atR]); at['!cols'] = autofit([atH, ...atR]);
  XLSX.utils.book_append_sheet(wb, at, 'Attribute Testing');

  const dfH = ['Deficiency', 'Control', 'Kind', 'Description', 'Root cause', 'Likelihood', 'Magnitude', 'Materiality', 'MW indicators', 'Severity', 'Remediation', 'Due', 'Status'];
  const dfR: (string | number)[][] = eng.deficiencies.length
    ? eng.deficiencies.map(d => [d.id, d.controlId, d.kind, d.description, d.rootCause, d.likelihood, d.magnitude, eng.materiality, d.mwIndicators.join('; ') || 'None', severityOf(d, eng.materiality), d.remediation.action, d.remediation.date ?? '—', d.remediation.status])
    : [['—', '—', '—', 'No deficiencies', '—', '—', 0, eng.materiality, '—', '—', '—', '—', '—']];
  const df = XLSX.utils.aoa_to_sheet([dfH, ...dfR]); df['!cols'] = autofit([dfH, ...dfR]);
  XLSX.utils.book_append_sheet(wb, df, 'Deficiencies');

  const scH = ['Account / disclosure', 'Balance', 'In scope', 'Assertions'];
  const scR: (string | number)[][] = eng.accounts.map(a => [a.name, a.balance, a.inScope ? 'Yes' : 'No', a.assertions.join('; ')]);
  const sc = XLSX.utils.aoa_to_sheet([scH, ...scR]); sc['!cols'] = autofit([scH, ...scR]);
  XLSX.utils.book_append_sheet(wb, sc, 'Scope');

  XLSX.writeFile(wb, `Working_Paper_ICFR_${eng.code}.xlsx`);
}

/** Per-control working paper: cover · attribute testing (TOD+TOE) · sampling · deficiency. */
export function downloadControlWorkingPaper(eng: IcfrEngagement, c: Control): void {
  const wb = XLSX.utils.book_new();
  const def = eng.deficiencies.find(d => d.controlId === c.id);
  const cover: (string | number)[][] = [
    ['Control Testing Working Paper'],
    [],
    ['Engagement', `${eng.name} (${eng.code})`],
    ['Framework', eng.framework],
    ['Period', `${eng.periodStart} – ${eng.periodEnd}`],
    [],
    ['Control ID', c.id],
    ['Control', c.description],
    ['Risk', `${c.riskId}: ${c.riskDescription}`],
    ['Nature / Type', `${c.nature} · ${c.type}`],
    ['Frequency', c.frequency],
    ['Key control', c.isKey ? 'Yes' : 'No'],
    ['Owner', c.owner],
    ['Precision', c.precision],
    ['Assertions', c.assertions.join('; ')],
    [],
    ['Test of Design', todRollup(c)],
    ['Operating effectiveness', toeRollup(c)],
    ['Conclusion', controlConclusion(c)],
    [],
    ['Prepared by', eng.preparer],
    ['Reviewed by', eng.reviewer],
  ];
  const cs = XLSX.utils.aoa_to_sheet(cover); cs['!cols'] = [{ wch: 22 }, { wch: 76 }];
  cs['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  XLSX.utils.book_append_sheet(wb, cs, 'Control');

  const atH = ['Attribute', 'Description', 'Assertion', 'TOD', 'TOD note', 'TOE', 'TOE procedures', 'TOE note'];
  const atR: (string | number)[][] = c.attributes.map(a => [a.code, a.description, a.assertion, a.tod.result, a.tod.note, a.toe.result, a.toe.procedures.join('; '), a.toe.note]);
  const at = XLSX.utils.aoa_to_sheet([atH, ...atR]); at['!cols'] = autofit([atH, ...atR]);
  XLSX.utils.book_append_sheet(wb, at, 'Attribute Testing');

  if (c.sampling && c.sampling.samples.length) {
    const sH = ['Sample Ref', 'Result'];
    const sR: (string | number)[][] = c.sampling.samples.map(s => [s.ref, c.attributes.some(a => a.toe.result === 'Fail') ? 'See exceptions' : c.attributes.some(a => a.toe.result === 'Pass') ? 'Pass' : 'Not tested']);
    const ss = XLSX.utils.aoa_to_sheet([sH, ...sR]); ss['!cols'] = autofit([sH, ...sR]);
    XLSX.utils.book_append_sheet(wb, ss, 'Sampling');
  }

  if (def) {
    const dH = ['Field', 'Value'];
    const dR: (string | number)[][] = [
      ['Kind', def.kind], ['Description', def.description], ['Root cause', def.rootCause],
      ['Likelihood', def.likelihood], ['Magnitude', def.magnitude], ['Materiality', eng.materiality],
      ['MW indicators', def.mwIndicators.join('; ') || 'None'], ['Severity', severityOf(def, eng.materiality)],
      ['Remediation', def.remediation.action], ['Due', def.remediation.date ?? '—'], ['Status', def.remediation.status],
    ];
    const ds = XLSX.utils.aoa_to_sheet([dH, ...dR]); ds['!cols'] = [{ wch: 16 }, { wch: 76 }];
    XLSX.utils.book_append_sheet(wb, ds, 'Deficiency');
  }

  XLSX.writeFile(wb, `Working_Paper_${c.id}.xlsx`);
}
