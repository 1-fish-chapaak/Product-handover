import * as XLSX from 'xlsx';
import { assessSeverity, controlConclusion, icfrConclusion, openMaterialWeaknesses, trackResult, designProgress } from './helpers';
import type { Control, IcfrEngagement, OperatingStep } from './types';

// The sign-off block every working paper carries: who signed, who countersigned,
// and the ICFR conclusion — stamped if signed, live-derived (and marked so) if not.
function signoffRows(eng: IcfrEngagement): (string | number)[][] {
  const so = eng.signoff;
  const mwOpen = openMaterialWeaknesses(eng).length;
  return [
    ['Prepared by', so.preparer ? `${so.preparer.by} — signed off ${so.preparer.at}` : `${eng.preparer} — NOT YET SIGNED`],
    ['Countersigned by', so.reviewer ? `${so.reviewer.by} — countersigned ${so.reviewer.at}` : `${eng.reviewer} — NOT YET COUNTERSIGNED`],
    ['ICFR conclusion', so.icfrConclusion ? `${so.icfrConclusion} (stamped at sign-off)` : `${icfrConclusion(eng)} (live — not yet signed; ${mwOpen} material weakness${mwOpen === 1 ? '' : 'es'} open)`],
    ['Engagement status', so.preparer && so.reviewer ? 'Concluded — record locked' : 'In progress'],
  ];
}

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
    ['Period', `${eng.periodStart} – ${eng.periodEnd}`],
    ['Overall materiality', eng.materiality],
    ['Performance materiality', eng.performanceMateriality],
    [],
    ['Prepared by', eng.signoff.preparer ? `${eng.signoff.preparer.by} — signed off ${eng.signoff.preparer.at}` : eng.preparer],
    ['Reviewed by', eng.signoff.reviewer ? `${eng.signoff.reviewer.by} — countersigned ${eng.signoff.reviewer.at}` : eng.reviewer],
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

  // Sign-off — its own sheet, first thing after the index
  const soSheet = XLSX.utils.aoa_to_sheet([['Engagement sign-off'], [], ...signoffRows(eng)]);
  soSheet['!cols'] = [{ wch: 22 }, { wch: 80 }];
  soSheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  XLSX.utils.book_append_sheet(wb, soSheet, 'Sign-off');

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

  // Operating testing — attribute-level (each attribute has its own workflow / attestation)
  const opH = ['W/P', 'Control ID', 'Attribute', 'Description', 'Assertion', 'Procedures', 'Workflow', 'Attested by', 'Attestation', 'Evidence', 'Result', 'Override rationale'];
  const opR: (string | number)[][] = eng.controls.flatMap(c => c.operating.steps.map(s => [c.wpRef, c.id, s.code, s.description, s.assertion, s.procedures.join('; '), s.workflowName ? `${s.workflowName}${s.workflowRunRef ? ` (${s.workflowRunRef})` : ''}` : '—', s.attestation?.by ?? '—', s.attestation?.note ?? '', s.attestation?.evidence.map(e => e.name).join('; ') ?? '', stepResult(s), s.override?.rationale ?? '']));
  const op = XLSX.utils.aoa_to_sheet([opH, ...opR]); op['!cols'] = autofit([opH, ...opR]);
  XLSX.utils.book_append_sheet(wb, op, 'Operating Testing');

  const dfH = ['Deficiency', 'Control', 'Track', 'Description', 'Root cause', 'Likelihood', 'Magnitude', 'Materiality', 'MW indicators', 'Compensating control', 'Severity', 'Remediation', 'Due', 'Status', 'Remediation evidence'];
  const dfR: (string | number)[][] = eng.deficiencies.length
    ? eng.deficiencies.map(d => {
        const a = assessSeverity(d, eng);
        const sev = a.bumped ? `${a.final} (prudent-official override)` : a.capped ? `${a.final} (capped from ${a.raw})` : a.final;
        return [d.id, d.controlId, d.track, d.description, d.rootCause, d.likelihood, d.magnitude, eng.materiality, d.mwIndicators.join('; ') || 'None', d.compensatingControlId ?? 'None', sev, d.remediation.action, d.remediation.date ?? '—', d.remediation.status, d.remediation.evidence?.map(f => f.name).join('; ') || 'None'];
      })
    : [['—', '—', '—', 'No deficiencies', '—', '—', 0, eng.materiality, '—', '—', '—', '—', '—', '—', '—']];
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
    ['Test of Design (independent)', `${trackResult(c.design)}${c.design.testedBy ? ` — ${c.design.testedBy}, ${c.design.testedAt}` : ''}`],
    ['Test of Operating Effectiveness (independent)', `${trackResult(c.operating)}${c.operating.testedBy ? ` — ${c.operating.testedBy}, ${c.operating.testedAt}` : ''}`],
    ['Control conclusion', controlConclusion(c)],
    [],
    ['Engagement sign-off', ''],
    ...signoffRows(eng),
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

  // Operating — each attribute evidenced on its own (workflow / self-attestation)
  const opH = ['Attribute', 'Description', 'Assertion', 'Precision', 'Procedures', 'Workflow', 'Attested by', 'Attestation', 'Evidence', 'Result', 'Override rationale'];
  const opR: (string | number)[][] = c.operating.steps.map(s => [s.code, s.description, s.assertion, s.precision, s.procedures.join('; '), s.workflowName ? `${s.workflowName}${s.workflowRunRef ? ` (${s.workflowRunRef})` : ''}` : '—', s.attestation?.by ?? '—', s.attestation?.note ?? '', s.attestation?.evidence.map(e => e.name).join('; ') ?? '', stepResult(s), s.override?.rationale ?? '']);
  const opMeta: (string | number)[][] = [['Method (dominant)', c.operating.method], ['Population', c.operating.population ? `${c.operating.population.count} · ${c.operating.population.source}` : '—'], ['Sample', c.operating.sampling ? `${c.operating.sampling.size} · ${c.operating.sampling.basis}` : '—'], []];
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
      ['MW indicators', def.mwIndicators.join('; ') || 'None'],
      ['Compensating control', def.compensatingControlId ?? 'None'],
      ['Severity', (() => { const a = assessSeverity(def, eng); return a.bumped ? `${a.final} (prudent-official override)` : a.capped ? `${a.final} (capped from ${a.raw} by ${def.compensatingControlId})` : a.final; })()],
      ['Remediation', def.remediation.action], ['Due', def.remediation.date ?? '—'], ['Status', def.remediation.status],
      ['Remediation evidence', def.remediation.evidence?.map(f => f.name).join('; ') || 'None'],
    ];
    const ds = XLSX.utils.aoa_to_sheet([dH, ...dR]); ds['!cols'] = [{ wch: 16 }, { wch: 76 }];
    XLSX.utils.book_append_sheet(wb, ds, 'Deficiency');
  }

  XLSX.writeFile(wb, `Working_Paper_${c.id}.xlsx`);
}
