import * as XLSX from 'xlsx';
import { controlConclusion, severityOf, trackResult, designProgress } from './helpers';
import type { Control, IcfrEngagement, OperatingStep } from './types';

function autofit(rows: (string | number)[][], max = 60): XLSX.ColInfo[] {
  const w: number[] = [];
  rows.forEach(r => r.forEach((c, i) => { w[i] = Math.min(max, Math.max(w[i] ?? 10, String(c ?? '').length + 2)); }));
  return w.map(wch => ({ wch }));
}
const stepResult = (s: OperatingStep): string => (s.override ? `${s.override.result} (overridden)` : s.result);

/** Consolidated ICFR working paper: Index · Control Summary · Design · Operating · Deficiencies · Scope. */
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
    ['Design concluded', eng.controls.filter(c => trackResult(c.design) !== 'Not tested').length],
    ['Operating concluded', eng.controls.filter(c => trackResult(c.operating) !== 'Not tested').length],
    ['Effective', concl.filter(c => c === 'Effective').length],
    ['Ineffective', concl.filter(c => c === 'Ineffective').length],
    ['Deficiencies', eng.deficiencies.length],
    [],
    ['Overall conclusion', overall],
    [],
    ['Legend', 'TOD = Test of Design (independent) · TOE = Test of Operating Effectiveness (independent) · severity = likelihood × magnitude vs materiality'],
  ];
  const ix = XLSX.utils.aoa_to_sheet(index);
  ix['!cols'] = [{ wch: 26 }, { wch: 70 }];
  ix['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  XLSX.utils.book_append_sheet(wb, ix, 'Index');

  const sumH = ['W/P', 'Control ID', 'Description', 'Process', 'Nature', 'Key', 'Owner', 'TOD (design)', 'TOE (operating)', 'TOE method', 'Conclusion'];
  const sumR: (string | number)[][] = eng.controls.map(c => [c.wpRef, c.id, c.description, c.process, c.nature, c.isKey ? 'Yes' : 'No', c.owner, trackResult(c.design), trackResult(c.operating), c.operating.method, controlConclusion(c)]);
  const sum = XLSX.utils.aoa_to_sheet([sumH, ...sumR]); sum['!cols'] = autofit([sumH, ...sumR]);
  XLSX.utils.book_append_sheet(wb, sum, 'Control Summary');

  // Design testing — documents + considerations + conclusion
  const dgH = ['W/P', 'Control ID', 'Documents received', 'Outstanding documents', 'Considerations passed', 'Conclusion', 'Override', 'Tested by'];
  const dgR: (string | number)[][] = eng.controls.map(c => {
    const p = designProgress(c);
    return [c.wpRef, c.id, `${p.docsReceived}/${p.docsTotal}`, c.design.documents.filter(d => d.status !== 'Received').map(d => d.kind).join('; ') || 'None', `${p.pointsPass}/${p.pointsTotal}`, c.design.conclusion, c.design.override ? `${c.design.override.result}: ${c.design.override.rationale}` : '—', c.design.testedBy ?? '—'];
  });
  const dg = XLSX.utils.aoa_to_sheet([dgH, ...dgR]); dg['!cols'] = autofit([dgH, ...dgR]);
  XLSX.utils.book_append_sheet(wb, dg, 'Design Testing');

  // Operating testing — step-level
  const opH = ['W/P', 'Control ID', 'Method', 'Attribute', 'Description', 'Assertion', 'Procedures', 'Result', 'Override rationale'];
  const opR: (string | number)[][] = eng.controls.flatMap(c => c.operating.steps.map(s => [c.wpRef, c.id, c.operating.method, s.code, s.description, s.assertion, s.procedures.join('; '), stepResult(s), s.override?.rationale ?? '']));
  const op = XLSX.utils.aoa_to_sheet([opH, ...opR]); op['!cols'] = autofit([opH, ...opR]);
  XLSX.utils.book_append_sheet(wb, op, 'Operating Testing');

  const dfH = ['Deficiency', 'Control', 'Track', 'Description', 'Root cause', 'Likelihood', 'Magnitude', 'Materiality', 'MW indicators', 'Severity', 'Remediation', 'Due', 'Status'];
  const dfR: (string | number)[][] = eng.deficiencies.length
    ? eng.deficiencies.map(d => [d.id, d.controlId, d.track, d.description, d.rootCause, d.likelihood, d.magnitude, eng.materiality, d.mwIndicators.join('; ') || 'None', severityOf(d, eng.materiality), d.remediation.action, d.remediation.date ?? '—', d.remediation.status])
    : [['—', '—', '—', 'No deficiencies', '—', '—', 0, eng.materiality, '—', '—', '—', '—', '—']];
  const df = XLSX.utils.aoa_to_sheet([dfH, ...dfR]); df['!cols'] = autofit([dfH, ...dfR]);
  XLSX.utils.book_append_sheet(wb, df, 'Deficiencies');

  const scH = ['Account / disclosure', 'Balance', 'In scope', 'Assertions'];
  const scR: (string | number)[][] = eng.accounts.map(a => [a.name, a.balance, a.inScope ? 'Yes' : 'No', a.assertions.join('; ')]);
  const sc = XLSX.utils.aoa_to_sheet([scH, ...scR]); sc['!cols'] = autofit([scH, ...scR]);
  XLSX.utils.book_append_sheet(wb, sc, 'Scope');

  XLSX.writeFile(wb, `Working_Paper_ICFR_${eng.code}.xlsx`);
}

/** Per-control working paper: cover · design · operating · sampling · deficiency. */
export function downloadControlWorkingPaper(eng: IcfrEngagement, c: Control): void {
  const wb = XLSX.utils.book_new();
  const def = eng.deficiencies.find(d => d.controlId === c.id);
  const cover: (string | number)[][] = [
    ['Control Testing Working Paper'],
    [],
    ['Engagement', `${eng.name} (${eng.code})`],
    ['W/P reference', c.wpRef],
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
    ['Test of Design (independent)', trackResult(c.design)],
    ['Test of Operating Effectiveness (independent)', trackResult(c.operating)],
    ['Control conclusion', controlConclusion(c)],
    [],
    ['Prepared by', eng.preparer],
    ['Reviewed by', eng.reviewer],
  ];
  const cs = XLSX.utils.aoa_to_sheet(cover); cs['!cols'] = [{ wch: 34 }, { wch: 76 }];
  cs['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  XLSX.utils.book_append_sheet(wb, cs, 'Control');

  // Design
  const dgH = ['Type', 'Item', 'Detail', 'Status / Result'];
  const dgR: (string | number)[][] = [
    ...c.design.documents.map(d => ['Document', d.kind, d.name, d.status] as (string | number)[]),
    ...c.design.points.map(p => ['Consideration', '', p.text, p.result] as (string | number)[]),
    ['Conclusion', '', c.design.override ? `Overridden: ${c.design.override.rationale}` : '', trackResult(c.design)],
  ];
  const dg = XLSX.utils.aoa_to_sheet([dgH, ...dgR]); dg['!cols'] = autofit([dgH, ...dgR]);
  XLSX.utils.book_append_sheet(wb, dg, 'Design (TOD)');

  // Operating
  const opH = ['Attribute', 'Description', 'Assertion', 'Precision', 'Procedures', 'Result', 'Override rationale'];
  const opR: (string | number)[][] = c.operating.steps.map(s => [s.code, s.description, s.assertion, s.precision, s.procedures.join('; '), stepResult(s), s.override?.rationale ?? '']);
  const opMeta: (string | number)[][] = [['Method', c.operating.method], ['Workflow', c.operating.workflowName ?? '—'], ['Population', c.operating.population ? `${c.operating.population.count} · ${c.operating.population.source}` : '—'], ['Sample', c.operating.sampling ? `${c.operating.sampling.size} · ${c.operating.sampling.basis}` : '—'], []];
  const op = XLSX.utils.aoa_to_sheet([...opMeta, opH, ...opR]); op['!cols'] = autofit([opH, ...opR]);
  XLSX.utils.book_append_sheet(wb, op, 'Operating (TOE)');

  if (c.operating.sampling && c.operating.sampling.samples.length) {
    const sH = ['Sample Ref', 'Result'];
    const sR: (string | number)[][] = c.operating.sampling.samples.map(s => [s.ref, s.result]);
    const ss = XLSX.utils.aoa_to_sheet([sH, ...sR]); ss['!cols'] = autofit([sH, ...sR]);
    XLSX.utils.book_append_sheet(wb, ss, 'Sampling');
  }

  if (def) {
    const dH = ['Field', 'Value'];
    const dR: (string | number)[][] = [
      ['Track', def.track], ['Description', def.description], ['Root cause', def.rootCause],
      ['Likelihood', def.likelihood], ['Magnitude', def.magnitude], ['Materiality', eng.materiality],
      ['MW indicators', def.mwIndicators.join('; ') || 'None'], ['Severity', severityOf(def, eng.materiality)],
      ['Remediation', def.remediation.action], ['Due', def.remediation.date ?? '—'], ['Status', def.remediation.status],
    ];
    const ds = XLSX.utils.aoa_to_sheet([dH, ...dR]); ds['!cols'] = [{ wch: 16 }, { wch: 76 }];
    XLSX.utils.book_append_sheet(wb, ds, 'Deficiency');
  }

  XLSX.writeFile(wb, `Working_Paper_${c.id}.xlsx`);
}
