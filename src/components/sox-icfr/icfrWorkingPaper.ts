import * as XLSX from 'xlsx';
import { assessSeverity, controlConclusion, formatDueDate, formatINR, icfrConclusion, isControlLocked, openMaterialWeaknesses, trackResult, designProgress } from './helpers';
import type { Control, IcfrEngagement, OperatingStep, TestResult } from './types';

// ─── The control working paper as a document ─────────────────────────────────────
// One flowing paper in the real-world W/P reading order (modelled on an actual SOX
// TOE working paper): header → sign-off → design → attributes & coverage → evidence
// references → tick legend → samples × attributes grid → results → conclusion.
// Both the preview modal and the .xlsx writer render these same blocks, so what
// you see before download is exactly what the file contains.
export type PaperBlock =
  | { kind: 'heading'; text: string; sub: string }
  | { kind: 'kv'; title?: string; rows: [string, string][] }
  | { kind: 'table'; title: string; note?: string; headers: string[]; rows: string[][]; tickFrom?: number }
  | { kind: 'note'; label: string; text: string; tone: 'good' | 'bad' | 'neutral' };

export const SIGNOFF_TITLE = 'Sign-off — audit record';

/** P / r ticks, as real working papers mark them. */
const tick = (r: TestResult | 'Effective' | 'Ineffective' | undefined): string =>
  r === 'Pass' || r === 'Effective' ? 'P' : r === 'Fail' || r === 'Ineffective' ? 'r' : '—';
const letter = (i: number): string => String.fromCharCode(65 + i);

/** Per-paper sign-off lines — this control's own preparer / countersign, not the engagement's. */
export function controlSignoffRows(eng: IcfrEngagement, c: Control): [string, string][] {
  const so = c.wpSignoff;
  const status = so?.preparer && so?.reviewer ? 'Signed & countersigned — paper closed'
    : so?.preparer ? 'Awaiting reviewer countersign'
    : isControlLocked(c) ? 'Ready to sign — control concluded'
    : 'Not ready — the control is not yet concluded';
  return [
    ['Prepared by', so?.preparer ? `${so.preparer.by} — signed off ${so.preparer.at}` : `${eng.preparer} — NOT YET SIGNED`],
    ['Countersigned by', so?.reviewer ? `${so.reviewer.by} — countersigned ${so.reviewer.at}` : `${eng.reviewer} — NOT YET COUNTERSIGNED`],
    ['Working-paper status', status],
  ];
}

/** The whole paper, in reading order. */
export function buildControlPaper(eng: IcfrEngagement, c: Control): PaperBlock[] {
  const steps = c.operating.steps;
  const samples = c.operating.sampling?.samples ?? [];
  const pop = c.operating.population;
  const def = eng.deficiencies.find(d => d.controlId === c.id);
  const blocks: PaperBlock[] = [];

  blocks.push({ kind: 'heading', text: `Working paper ${c.wpRef} — Test of Design & Operating Effectiveness`, sub: `${eng.entity} · SOX compliance · Process: ${c.process} / ${c.subProcess}` });

  blocks.push({
    kind: 'kv', title: 'Control', rows: [
      ['Control owner', c.owner],
      ['Control number', c.id],
      ['Control description', c.description],
      ['Control frequency', c.frequency],
      ['Nature / type', `${c.nature} · ${c.type}${c.isKey ? ' · Key control' : ''}`],
      ['Risk addressed', `${c.riskId} — ${c.riskDescription}`],
      ['Assertions', c.assertions.join(', ')],
      ['Precision', c.precision],
      ['Period', `${eng.periodStart} – ${eng.periodEnd} · ${eng.period} round`],
    ],
  });

  blocks.push({ kind: 'kv', title: SIGNOFF_TITLE, rows: controlSignoffRows(eng, c) });

  // Test of design — documents received + each consideration ticked
  const docsIn = c.design.documents.filter(d => d.status === 'Received').length;
  const outstanding = c.design.documents.filter(d => d.status !== 'Received').map(d => d.kind);
  blocks.push({
    kind: 'table', title: 'Test of design',
    note: `${docsIn}/${c.design.documents.length} design documents received${outstanding.length ? ` · outstanding: ${outstanding.join(', ')}` : ''}`,
    headers: ['', 'Design consideration', 'Tick'],
    rows: c.design.points.map((p, i) => [String(i + 1), p.text, tick(p.override?.result ?? p.result)]),
    tickFrom: 2,
  });

  // To be tested — every attribute with its population and sample coverage
  blocks.push({
    kind: 'table', title: 'To be tested — attributes & coverage',
    note: pop ? `Population: ${pop.count} items from ${pop.source}${pop.ipeValidated ? ' (IPE validated)' : ''}` : 'No population drawn',
    headers: ['', 'Attribute', 'Assertion', 'Population', 'Samples drawn', 'Samples tested', 'Exceptions'],
    rows: steps.map((s, i) => {
      const results = samples.map(smp => s.sampleResults?.[smp.id]).filter(r => r && r !== 'Not tested');
      const fails = results.filter(r => r === 'Fail').length;
      const exceptions = results.length ? String(fails) : s.result === 'Fail' ? '1' : s.result === 'Pass' ? '0' : '—';
      return [letter(i), `${s.description} (${s.code})`, s.assertion, pop ? String(pop.count) : '—', String(samples.length), samples.length ? String(results.length) : s.result !== 'Not tested' ? 'attribute-level' : '—', exceptions];
    }),
  });

  // Evidence — what backs each attribute, and who provided it
  blocks.push({
    kind: 'table', title: 'Evidence & W/P reference',
    headers: ['', 'Attribute', 'Evidence — W/P reference', 'Provided by'],
    rows: steps.map((s, i) => {
      const ev = [
        s.workflowName ? `${s.workflowName}${s.workflowRunRef ? ` (${s.workflowRunRef})` : ''}` : null,
        s.inputFile?.name ?? null,
        s.validation?.fileName && s.validation.fileName !== s.inputFile?.name ? s.validation.fileName : null,
        ...(s.attestation?.evidence.map(e => e.name) ?? []),
      ].filter(Boolean).join(' · ');
      return [letter(i), s.code, ev || '—', s.attestation?.by ?? c.owner];
    }),
  });

  blocks.push({
    kind: 'kv', title: 'Test legend', rows: [
      ['P', 'Attribute satisfied'],
      ['r', 'Attribute not satisfied — exception'],
      ['—', 'Not yet tested'],
    ],
  });

  // The heart of the paper: every sampled item × every attribute, ticked
  if (samples.length) {
    blocks.push({
      kind: 'table', title: 'Details of samples tested',
      note: `${c.operating.sampling!.method} sample of ${samples.length} — each item tested against every attribute`,
      headers: ['S.No', 'Sample', ...steps.map((s, i) => `${letter(i)} · ${s.code}`)],
      rows: samples.map((smp, i) => [String(i + 1), smp.ref, ...steps.map(s => tick(s.sampleResults?.[smp.id]))]),
      tickFrom: 2,
    });
  } else {
    blocks.push({ kind: 'note', label: 'Samples', text: 'No samples drawn — evidence is attribute-level (automated / full-population / attestation).', tone: 'neutral' });
  }

  // Results narrative + conclusion
  const d = trackResult(c.design); const o = trackResult(c.operating);
  const totalFails = steps.reduce((n, s) => n + samples.filter(smp => s.sampleResults?.[smp.id] === 'Fail').length, 0);
  const results = [
    `Design: ${d}${c.design.points.length ? ` — ${c.design.points.filter(p => (p.override?.result ?? p.result) === 'Pass').length}/${c.design.points.length} considerations satisfied` : ''}.`,
    `Operating: ${o}${steps.length ? ` — ${steps.length} attribute${steps.length === 1 ? '' : 's'} tested${samples.length ? ` across ${samples.length} samples, ${totalFails} exception${totalFails === 1 ? '' : 's'}` : ''}` : ''}.`,
    c.operating.testedBy ? `Tested by ${c.operating.testedBy}, ${c.operating.testedAt}.` : '',
  ].filter(Boolean).join(' ');
  const concl = controlConclusion(c);
  blocks.push({ kind: 'note', label: 'Test results', text: results, tone: concl === 'Effective' ? 'good' : concl === 'Ineffective' ? 'bad' : 'neutral' });
  blocks.push({ kind: 'note', label: 'Conclusion', text: `${concl} control`, tone: concl === 'Effective' ? 'good' : concl === 'Ineffective' ? 'bad' : 'neutral' });

  // Linked exception, if the testing raised one
  if (def) {
    const a = assessSeverity(def, eng);
    blocks.push({
      kind: 'kv', title: `Exception — ${def.id}`, rows: [
        ['Description', def.description],
        ['Severity', a.bumped ? `${a.final} (prudent-official override)` : a.capped ? `${a.final} (capped from ${a.raw})` : a.final],
        ['Status', def.status],
        ['Remediation', `${def.remediation.action || '—'}${def.remediation.date ? ` · due ${formatDueDate(def.remediation.date)}` : ''} · ${def.remediation.owner}`],
        ['Remediation evidence', def.remediation.evidence?.map(f => f.name).join('; ') || 'None'],
      ],
    });
  }

  return blocks;
}

/** The control paper regrouped into sheet-style sections for the tabbed preview.
 *  The .xlsx stays ONE flowing sheet (real-audit format) — the tabs just page
 *  through that same reading order. */
export function controlPaperSections(eng: IcfrEngagement, c: Control): IcfrSheet[] {
  const order = ['Control', 'Sign-off', 'Design Testing', 'Operating Testing', 'Results'] as const;
  const sectionOf = (b: PaperBlock): (typeof order)[number] => {
    if (b.kind === 'heading') return 'Control';
    if (b.kind === 'kv') {
      if (b.title === SIGNOFF_TITLE) return 'Sign-off';
      if (b.title === 'Control') return 'Control';
      if (b.title === 'Test legend') return 'Operating Testing';
      return 'Results'; // linked exception
    }
    if (b.kind === 'table') return b.title === 'Test of design' ? 'Design Testing' : 'Operating Testing';
    return b.label === 'Samples' ? 'Operating Testing' : 'Results'; // notes
  };
  const grouped = new Map<string, PaperBlock[]>(order.map(n => [n, []]));
  buildControlPaper(eng, c).forEach(b => grouped.get(sectionOf(b))!.push(b));
  return order.map(name => ({ name, blocks: grouped.get(name)! })).filter(s => s.blocks.length > 0);
}

// The sign-off block every working paper carries: who signed, who countersigned,
// and the ICFR conclusion — stamped if signed, live-derived (and marked so) if not.
function signoffRows(eng: IcfrEngagement): [string, string][] {
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

// ─── The consolidated engagement paper, sheet by sheet ───────────────────────────
// Same contract as the control paper: the preview modal and the .xlsx writer both
// render these blocks, so what you see before download is exactly what the file
// contains. Pass the register's visible controls to export a filtered paper —
// Deficiencies and every count follow the subset; Scope (significant accounts)
// and the sign-off stay engagement-wide, they are not per-control facts.
export type IcfrSheet = { name: string; blocks: PaperBlock[] };

export const ENG_SIGNOFF_TITLE = 'Engagement sign-off';

export function buildIcfrPaper(eng: IcfrEngagement, controls: Control[] = eng.controls): IcfrSheet[] {
  const ids = new Set(controls.map(c => c.id));
  const defs = eng.deficiencies.filter(d => ids.has(d.controlId));
  const concl = controls.map(controlConclusion);
  const overall = concl.includes('Ineffective')
    ? 'Deficiencies identified — see Deficiencies sheet'
    : concl.length && concl.every(c => c === 'Effective') ? 'Effective — no exceptions' : 'Testing in progress';
  const filteredOut = eng.controls.length - controls.length;

  const index: IcfrSheet = {
    name: 'Index', blocks: [
      { kind: 'heading', text: 'Internal Control over Financial Reporting (ICFR) — Working Paper', sub: `${eng.entity} · ${eng.name} (${eng.code})` },
      ...(filteredOut > 0 ? [{ kind: 'note', label: 'Filtered', text: `This paper covers the ${controls.length} controls visible in the control library — ${filteredOut} filtered out.`, tone: 'neutral' } as PaperBlock] : []),
      {
        kind: 'kv', title: 'Engagement', rows: [
          ['Entity', eng.entity],
          ['Engagement', `${eng.name} (${eng.code})`],
          ['Framework', eng.framework],
          ['Period', `${eng.periodStart} – ${eng.periodEnd} · ${eng.period} round`],
          ['Overall materiality', formatINR(eng.materiality)],
          ['Performance materiality', formatINR(eng.performanceMateriality)],
          ['Prepared by', eng.signoff.preparer ? `${eng.signoff.preparer.by} — signed off ${eng.signoff.preparer.at}` : eng.preparer],
          ['Reviewed by', eng.signoff.reviewer ? `${eng.signoff.reviewer.by} — countersigned ${eng.signoff.reviewer.at}` : eng.reviewer],
        ],
      },
      {
        kind: 'kv', title: 'Progress', rows: [
          ['Controls in scope', String(controls.length)],
          ['Key controls', String(controls.filter(c => c.isKey).length)],
          ['Design concluded', String(controls.filter(c => trackResult(c.design) !== 'Not tested').length)],
          ['Operating concluded', String(controls.filter(c => trackResult(c.operating) !== 'Not tested').length)],
          ['Effective', String(concl.filter(c => c === 'Effective').length)],
          ['Ineffective', String(concl.filter(c => c === 'Ineffective').length)],
          ['Deficiencies', String(defs.length)],
          ['Overall conclusion', overall],
        ],
      },
      {
        kind: 'kv', title: 'Legend', rows: [
          ['TOD', 'Test of Design (independent)'],
          ['TOE', 'Test of Operating Effectiveness (independent)'],
          ['Severity', 'likelihood × magnitude vs materiality'],
        ],
      },
    ],
  };

  const signoff: IcfrSheet = { name: 'Sign-off', blocks: [{ kind: 'kv', title: ENG_SIGNOFF_TITLE, rows: signoffRows(eng) }] };

  const summary: IcfrSheet = {
    name: 'Control Summary', blocks: [{
      kind: 'table', title: 'Control summary', note: `${controls.length} controls`,
      headers: ['W/P', 'Control ID', 'Description', 'Process', 'Nature', 'Key', 'Owner', 'TOD (design)', 'TOE (operating)', 'TOE method', 'Conclusion'],
      rows: controls.map(c => [c.wpRef, c.id, c.description, c.process, c.nature, c.isKey ? 'Yes' : 'No', c.owner, trackResult(c.design), trackResult(c.operating), c.operating.method, controlConclusion(c)]),
    }],
  };

  // Design testing — documents + considerations + conclusion
  const design: IcfrSheet = {
    name: 'Design Testing', blocks: [{
      kind: 'table', title: 'Test of design', note: 'documents received · considerations ticked · conclusion per control',
      headers: ['W/P', 'Control ID', 'Documents received', 'Outstanding documents', 'Considerations passed', 'Conclusion', 'Override', 'Tested by'],
      rows: controls.map(c => {
        const p = designProgress(c);
        return [c.wpRef, c.id, `${p.docsReceived}/${p.docsTotal}`, c.design.documents.filter(d => d.status !== 'Received').map(d => d.kind).join('; ') || 'None', `${p.pointsPass}/${p.pointsTotal}`, c.design.conclusion, c.design.override ? `${c.design.override.result}: ${c.design.override.rationale}` : '—', c.design.testedBy ?? '—'];
      }),
    }],
  };

  // Operating testing — attribute-level (each attribute has its own workflow / attestation)
  const opRows = controls.flatMap(c => c.operating.steps.map(s => [c.wpRef, c.id, s.code, s.description, s.assertion, s.procedures.join('; '), s.workflowName ? `${s.workflowName}${s.workflowRunRef ? ` (${s.workflowRunRef})` : ''}` : '—', s.attestation?.by ?? '—', s.attestation?.note ?? '', s.attestation?.evidence.map(e => e.name).join('; ') ?? '', stepResult(s), s.override?.rationale ?? '']));
  const operating: IcfrSheet = {
    name: 'Operating Testing', blocks: [{
      kind: 'table', title: 'Test of operating effectiveness', note: `${opRows.length} attribute rows`,
      headers: ['W/P', 'Control ID', 'Attribute', 'Description', 'Assertion', 'Procedures', 'Workflow', 'Attested by', 'Attestation', 'Evidence', 'Result', 'Override rationale'],
      rows: opRows,
    }],
  };

  const deficiencies: IcfrSheet = {
    name: 'Deficiencies', blocks: [{
      kind: 'table', title: 'Deficiencies', note: defs.length ? `${defs.length} exception${defs.length === 1 ? '' : 's'}` : 'No exceptions raised',
      headers: ['Deficiency', 'Control', 'Track', 'Description', 'Root cause', 'Likelihood', 'Magnitude', 'Materiality', 'MW indicators', 'Compensating control', 'Severity', 'Remediation', 'Due', 'Status', 'Remediation evidence'],
      rows: defs.map(d => {
        const a = assessSeverity(d, eng);
        const sev = a.bumped ? `${a.final} (prudent-official override)` : a.capped ? `${a.final} (capped from ${a.raw})` : a.final;
        return [d.id, d.controlId, d.track, d.description, d.rootCause, d.likelihood, String(d.magnitude), formatINR(eng.materiality), d.mwIndicators.join('; ') || 'None', d.compensatingControlId ?? 'None', sev, d.remediation.action, formatDueDate(d.remediation.date), d.remediation.status, d.remediation.evidence?.map(f => f.name).join('; ') || 'None'];
      }),
    }],
  };

  const scope: IcfrSheet = {
    name: 'Scope', blocks: [{
      kind: 'table', title: 'Scope — significant accounts', note: `${eng.accounts.length} significant accounts (engagement-wide)`,
      headers: ['Account / disclosure', 'Balance', 'In scope', 'Assertions'],
      rows: eng.accounts.map(a => [a.name, formatINR(a.balance), a.inScope ? 'Yes' : 'No', a.assertions.join('; ')]),
    }],
  };

  return [index, signoff, summary, design, operating, deficiencies, scope];
}

/** Consolidated ICFR working paper — every sheet rendered from the same blocks the preview shows. */
export function downloadIcfrWorkingPaper(eng: IcfrEngagement, controls: Control[] = eng.controls): void {
  const wb = XLSX.utils.book_new();
  for (const sheet of buildIcfrPaper(eng, controls)) {
    const aoa: (string | number)[][] = [];
    sheet.blocks.forEach(b => {
      if (b.kind === 'heading') { aoa.push([b.text], [b.sub]); }
      else if (b.kind === 'kv') { if (b.title) aoa.push([b.title.toUpperCase()]); b.rows.forEach(r => aoa.push([...r])); }
      else if (b.kind === 'table') { aoa.push([b.title.toUpperCase()]); if (b.note) aoa.push([b.note]); aoa.push(b.headers, ...b.rows); }
      else { aoa.push([b.label.toUpperCase(), b.text]); }
      aoa.push([]); // breathing row between blocks
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = autofit(aoa, 90);
    if (sheet.blocks[0]?.kind === 'heading') ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }];
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  XLSX.writeFile(wb, `Working_Paper_ICFR_${eng.code}.xlsx`);
}

/** Per-control working paper — ONE sheet, the same blocks the preview shows. */
export function downloadControlWorkingPaper(eng: IcfrEngagement, c: Control): void {
  const wb = XLSX.utils.book_new();
  const aoa: (string | number)[][] = [];
  buildControlPaper(eng, c).forEach(b => {
    if (b.kind === 'heading') { aoa.push([b.text], [b.sub]); }
    else if (b.kind === 'kv') { if (b.title) aoa.push([b.title.toUpperCase()]); b.rows.forEach(r => aoa.push(r)); }
    else if (b.kind === 'table') {
      aoa.push([b.title.toUpperCase()]);
      if (b.note) aoa.push([b.note]);
      aoa.push(b.headers, ...b.rows);
    } else { aoa.push([b.label.toUpperCase(), b.text]); }
    aoa.push([]); // breathing row between blocks
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = autofit(aoa, 90);
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }];
  XLSX.utils.book_append_sheet(wb, ws, 'Working paper');
  XLSX.writeFile(wb, `Working_Paper_${c.id}.xlsx`);
}
