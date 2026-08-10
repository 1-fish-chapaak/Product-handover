import * as XLSX from 'xlsx';
import { assessSeverity, auditorProvenChecks, combinedSample, conclusionOf, controlConclusion, designBasis, operatingApplies, countVerdict, coverageVerdict, fileOriginOf, designOutstanding, formatDueDate, formatINR, icfrConclusion, isControlLocked, itgcHolds, openMaterialWeaknesses, sampleSizeGuide, trackResult, designProgress } from './helpers';
import { FIVE_W_1H, gapNature } from './types';
import { ownersOf } from './auditScope';
// ─── PARKED (Aug 2026) — Priced impact & Gap type ────────────────────────────
// Restore this import alongside the blocks parked further down the file.
//
// import { exposureTotal, FIVE_W_1H, GAP_LABEL } from './types';
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
export const IPE_TITLE = 'Information produced by the entity (IPE)';
export const WALKTHROUGH_TITLE = 'Walkthrough — design tested on one transaction';
export const WALKTHROUGH_TABLE = 'Walkthrough — attributes on the walked transaction';
export const JUDGEMENTS_TITLE = 'Design judgements';
export const DESIGN_ELEMENTS_TABLE = 'Design elements — evidence & waivers';

/** How the drawn sample falls across the quarters. A quarterly-or-less control is
 *  stated as its own cadence; anything sampled gets an even spread, which is what
 *  the reviewer's workbook shows and what a reader checks the coverage against. */
function quarterlySplit(c: Control): string {
  const n = c.operating.sampling?.samples.length ?? 0;
  if (!n) return 'No sample drawn';
  if (c.frequency === 'Annual') return 'Annual control — single occurrence, no quarterly split';
  const per = Math.floor(n / 4), rem = n % 4;
  const q = [0, 1, 2, 3].map(i => per + (i < rem ? 1 : 0));
  return `Q1 ${q[0]} · Q2 ${q[1]} · Q3 ${q[2]} · Q4 ${q[3]} (${n} items)`;
}

/** P / r ticks, as real working papers mark them. */
const tick = (r: TestResult | 'Effective' | 'Ineffective' | undefined): string =>
  r === 'Pass' || r === 'Effective' ? 'P' : r === 'Fail' || r === 'Ineffective' ? 'r' : '—';
const letter = (i: number): string => String.fromCharCode(65 + i);

/** The Period line both papers print.
 *
 *  The engagement no longer carries an Interim / Year-end round of its own —
 *  that field and the togglePeriod / rollForward actions that moved it were
 *  removed. The period now comes from the newest audit created on the Audit
 *  logs tab, which is where a period is actually chosen.
 *
 *  Until an audit exists there is nothing to read, so this falls back to the
 *  engagement's own start/end dates: a paper exported early still states the
 *  span it covers instead of going blank. */
export function periodLine(eng: IcfrEngagement): string {
  const latest = eng.audits[0];   // createAudit prepends, so [0] is newest
  return latest
    ? `${latest.periodSpan} · ${latest.period}`
    : `${eng.periodStart} – ${eng.periodEnd}`;
}

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
  const ipe = c.operating.ipe;
  const def = eng.deficiencies.find(d => d.controlId === c.id);
  const blocks: PaperBlock[] = [];

  blocks.push({ kind: 'heading', text: `Working paper ${c.wpRef} — TOD & TOE`, sub: `${eng.entity} · SOX compliance · Process: ${c.process} / ${c.subProcess}` });

  // Sized the way the SCREEN sized it. Read without the engagement, this printed
  // "1 (test of one)" on a control the app had already resized to 25 because an
  // ITGC underneath it failed — the paper contradicting the working file it is
  // supposed to be a record of.
  const guide = sampleSizeGuide(c, itgcHolds(eng, c));
  // The two population checks are computed, not attested — so the paper prints
  // what the application concluded and, where it disagreed, the reason it was
  // overridden. A row that only ever said "ticked" told a reviewer nothing.
  const audit = eng.audits.find(a => a.controlIds?.includes(c.id)) ?? eng.audits[0];
  const cv = countVerdict(c);
  const gv = coverageVerdict(c, audit?.windowFrom, audit?.windowTo);
  // 'Variance' and 'Failed' are not interchangeable on a paper a reviewer reads:
  // an overshoot is a filter that swept wide, a shortfall is a population with a
  // hole in it, and only the second is a completeness problem.
  const VERDICT_WORD = { pass: 'Passed', warn: 'Variance', fail: 'Failed' } as const;
  const verdictLine = (v: typeof cv, note?: string) =>
    v ? `${VERDICT_WORD[v.level]} — ${v.headline}. ${v.detail}${v.blocks ? (note ? ` Accepted with reason: ${note}` : ' NOT RESOLVED.') : ''}` : null;
  const popCheck = verdictLine(cv, pop?.countNote);
  const coverCheck = verdictLine(gv, pop?.coverageNote);
  blocks.push({
    kind: 'kv', title: 'Control', rows: [
      ['Control owner', c.owner],
      // The paper names both: a reviewer asking "who was this chased from" needs
      // the process owner, and it is not always the accountable name above.
      ...(ownersOf(c).single ? [] : [['Process owner', ownersOf(c).processOwner] as [string, string]]),
      ['Control number', c.id],
      // what the control is FOR, above what it does and how it is worded
      ['Control objective', c.objective ?? '—'],
      ['Control description', c.description],
      ['Control activity', c.controlActivity ?? '—'],
      ['Classification', c.clazz ?? '—'],
      ['Control frequency', c.frequency],
      ['Nature / type', `${c.nature} · ${c.type} · ${c.isKey ? 'Key control' : 'Non-key control'}`],
      // the rating and the size it drives, side by side — the reviewer sizes on
      // frequency AND rating, so a paper that prints one without the other is
      // asking the reader to take the number on trust
      ['Risk rating', c.riskRating ?? 'Not rated'],
      ['Sample size — indicated', `${guide.suggested} (${guide.range}) — ${guide.note}`],
      ['Sample size — drawn', c.operating.sampling ? `${c.operating.sampling.samples.length} · ${c.operating.sampling.method}, ${c.operating.sampling.basis}` : 'None drawn'],
      // The two facts that make a draw reperformable. A reviewer who cannot
      // re-run the selection cannot check that it was not steered.
      ['Selection method / seed', c.operating.sampling
        ? `${c.operating.sampling.method}${c.operating.sampling.seed ? ` · seed ${c.operating.sampling.seed}` : ' · no seed (judgemental selection)'}`
        : '—'],
      ['Population filter', c.operating.population?.criteria ?? '—'],
      ['Filtered from', c.operating.population?.sourceFile ? `${c.operating.population.sourceFile}${c.operating.population.sourceCount != null ? ` · ${c.operating.population.sourceCount.toLocaleString()} rows` : ''}` : '—'],
      ['Population locked', c.operating.population?.locked ? `${c.operating.population.locked.by}, ${c.operating.population.locked.at}` : 'Not locked'],
      // What the population IS. The on-screen definition form was dropped, so
      // this only prints where a definition actually exists — an always-"Not
      // defined" row would read as an outstanding item nobody can clear.
      ...(c.operating.definition
        ? [['Population definition', `${c.operating.definition.basis} · one instance = ${c.operating.definition.instance} · ${c.operating.definition.expectedCount} expected${c.operating.definition.countOverridden ? ' (overridden)' : ''} · rejected items ${c.operating.definition.includeRejected ? 'counted' : 'excluded'}`]] as [string, string][]
        : []),
      ['Population version', c.operating.population?.version ?? '—'],
      // Where the data came from — read off the FILE record, not off this
      // population. The paper therefore always prints what the file says today:
      // a provenance corrected on the file record reaches every paper drawn off
      // it, which is the point of holding it in one place.
      ['File origin', (() => {
        const p = c.operating.population;
        if (!p?.sourceFile) return '—';
        const o = fileOriginOf(eng, p.sourceFile, p.provenance?.system);
        if (o.systemFetched) return 'Fetched by the system';
        if (!o.origin) return 'Not answered';
        return `${o.origin}${o.by ? ` · recorded by ${o.by}, ${o.at}` : ' · recorded at upload'}`;
      })()],
      ['Source system', c.operating.population?.provenance?.system ?? '—'],
      // Either half can be blank — the extract stamps whoever ran it and nothing
      // else, so an empty half must not print as a trailing separator.
      ['Extracted by / on', [c.operating.population?.provenance?.extractedBy, c.operating.population?.provenance?.extractedOn]
        .map(x => x?.trim()).filter(Boolean).join(' · ') || '—'],
      // The two checks the application ran itself, the auditor's answer where
      // one of them did not hold, and the agreement that the count reads right.
      ...(popCheck ? [['Count check', popCheck]] as [string, string][] : []),
      ...(coverCheck ? [['Period coverage', coverCheck]] as [string, string][] : []),
      ['Count agreed', c.operating.population?.countConfirmed
        ? `${c.operating.population.countConfirmed.by}, ${c.operating.population.countConfirmed.at}`
        : '—'],
      ['Quarterly split', quarterlySplit(c)],
      ['Risk addressed', `${c.riskId} — ${c.riskDescription}`],
      ['Root cause', c.rootCause ?? '—'],
      ['Assertions', c.assertions.join(', ')],
      ['Precision', c.precision],
      ['Period', periodLine(eng)],
      // Where the evidence physically lives, and which report paragraph this row
      // lands in. Both outlive the engagement, so the paper has to cite them.
      ['Performed by', c.performedBy ?? '—'],
      ['W/P reference — hard copy', c.wpRefHard ?? '—'],
      ['W/P reference — soft copy', c.wpRefSoft ?? '—'],
      ['Report reference', c.reportRef ?? '—'],
    ],
  });

  // The audit programme — the steps actually walked, as instructions rather than
  // conclusions. A reviewer re-performs the test off this list.
  if (c.auditSteps?.length) {
    blocks.push({
      kind: 'table', title: 'Audit programme — steps performed',
      note: `${c.auditSteps.length} step${c.auditSteps.length === 1 ? '' : 's'}${c.performedBy ? ` · performed by ${c.performedBy}` : ''}`,
      headers: ['', 'Step'],
      rows: c.auditSteps.map((s, i) => [String(i + 1), s]),
    });
  }

  blocks.push({ kind: 'kv', title: SIGNOFF_TITLE, rows: controlSignoffRows(eng, c) });

  // Test of design — documents received + each consideration ticked
  const docsIn = c.design.documents.filter(d => d.status === 'Received').length;
  const waived = c.design.documents.filter(d => d.waiver && d.status !== 'Received');
  const outstanding = designOutstanding(c).map(d => d.kind);
  // The evidence TYPE column is the honest column: a consideration ticked off
  // somebody's word reads very differently from one the auditor reperformed, and
  // a paper that prints only the tick invites the reader to assume the stronger.
  blocks.push({
    kind: 'table', title: 'TOD',
    note: [
      `${docsIn}/${c.design.documents.length} design documents received${waived.length ? ` · ${waived.length} waived` : ''}${outstanding.length ? ` · outstanding: ${outstanding.join(', ')}` : ''}`,
      // Derived from the auditor's own proof across the checks, not asserted —
      // see designBasis. A reader can now check the claim against the two
      // columns below it rather than taking the sentence on trust.
      `basis: ${designBasis(c)} (${auditorProvenChecks(c)}/${c.design.points.length} checks carry the auditor's own proof)`,
    ].join(' · '),
    // What backs each check, split by who produced it. A check evidenced only by
    // the client's documents and one the auditor reperformed both tick the same
    // box, and a paper that prints only the tick invites the reader to assume
    // the stronger of the two.
    // "About" names the attribute a check belongs to, the same way the
    // walkthrough table below labels its rows. Without it an attribute-level
    // check prints as an undifferentiated numbered row, and a reader cannot tell
    // which of five things the control has to do it actually tested.
    headers: ['', 'About', 'Design consideration', 'Evidenced by (client)', "Auditor's own proof", 'Tick'],
    rows: c.design.points.map((p, i) => {
      const on = p.stepId ? c.operating.steps.find(s => s.id === p.stepId) : undefined;
      return [
        String(i + 1),
        on ? `${on.description} (${on.code})` : 'The control',
        p.text,
        c.design.documents.filter(d => p.evidencedBy?.includes(d.id)).map(d => (d.kind === 'Custom' ? d.name : d.kind)).join('; ') || '—',
        p.auditorProof ? `${p.auditorProof.kind} — ${p.auditorProof.file.name}` : '—',
        tick(p.override?.result ?? p.result),
      ];
    }),
    tickFrom: 5,
  });

  // Every design element with what backs it — and, where nothing does, the reason
  // it was waived. A waiver the paper doesn't show is an unexplained hole in the
  // completeness the conclusion rests on.
  if (c.design.documents.length) {
    blocks.push({
      kind: 'table', title: DESIGN_ELEMENTS_TABLE,
      note: `${docsIn} evidenced · ${waived.length} waived · ${outstanding.length} outstanding`,
      headers: ['', 'Element', 'Required', 'Status', 'Evidence / reason', 'Recorded by'],
      rows: c.design.documents.map((d, i) => [
        String(i + 1),
        d.kind === 'Custom' ? d.name : d.kind,
        d.required === false ? 'Optional' : 'Required',
        d.status === 'Received' ? 'Evidenced' : d.waiver ? 'Waived' : d.status,
        d.status === 'Received'
          ? (d.files?.map(f => f.name).join(' · ') || d.name)
          : d.waiver ? `${d.waiver.reason} — ${d.waiver.note}` : 'Not provided',
        d.status === 'Received' ? `${d.uploadedBy ?? '—'}${d.at ? `, ${d.at}` : ''}` : d.waiver ? `${d.waiver.by}, ${d.waiver.at}` : '—',
      ]),
    });
  }

  // The walkthrough — who was in the room, which transaction was walked, and what
  // each attribute showed on it. Captured on the control page, printed from there.
  const w = c.design.walkthrough;
  if (w) {
    blocks.push({
      kind: 'kv', title: WALKTHROUGH_TITLE, rows: [
        ['Transaction walked', w.sampleRef],
        ['Date walked', w.date],
        ['Performed by', w.tester],
        ['Attended by (client)', w.attendees.length ? w.attendees.join(' · ') : 'Not recorded'],
        ['What it showed', w.notes?.trim() || '—'],
      ],
    });
    if (steps.length) {
      const walkTested = steps.filter(s => (w.attributeResults[s.id] ?? 'Not tested') !== 'Not tested').length;
      blocks.push({
        kind: 'table', title: WALKTHROUGH_TABLE,
        note: `${walkTested}/${steps.length} attributes tested on ${w.sampleRef} — the same attributes the sample tests, proved once on a live transaction`,
        headers: ['', 'Attribute', 'Assertion', 'Result on ' + w.sampleRef, 'Tick'],
        rows: steps.map((s, i) => {
          const r = w.attributeResults[s.id] ?? 'Not tested';
          return [letter(i), `${s.description} (${s.code})`, s.assertion, r, tick(r)];
        }),
        tickFrom: 4,
      });
    }
  } else {
    blocks.push({ kind: 'note', label: 'Walkthrough', text: 'No walkthrough recorded — the design has not been tested against a live transaction.', tone: 'neutral' });
  }

  // The four judgements the paper has to state rather than imply.
  const j = c.design.judgements;
  const compensating = j?.compensatingControlId ? eng.controls.find(x => x.id === j.compensatingControlId) : undefined;
  const stated = (v: boolean | undefined): string => v === true ? 'Yes' : v === false ? 'No' : 'Not stated';
  blocks.push({
    kind: 'kv', title: JUDGEMENTS_TITLE, rows: [
      ...FIVE_W_1H.map(a => [
        `Description answers “${a.k}”`,
        j?.coverage?.[a.k] === true ? 'Present' : j?.coverage?.[a.k] === false ? 'MISSING' : 'Not stated',
      ] as [string, string]),
      ['Compensating control', compensating ? `${compensating.id} — ${compensating.description}` : j?.compensatingControlId ? j.compensatingControlId : 'None identified'],
      ['Frequency appropriate to the risk', stated(j?.frequencyAppropriate)],
      [`Control type appropriate (${c.type})`, stated(j?.typeAppropriate)],
      ['Basis', j?.note?.trim() || '—'],
      ['Recorded by', j?.by ? `${j.by}, ${j.at}` : 'Not recorded'],
    ],
  });

  // IPE — the report the population came out of, and the three checks that proved
  // it. Printed BEFORE the attributes table because that is the order the work
  // happened in: nothing below is worth reading if the report itself didn't hold.
  if (ipe) {
    blocks.push({
      kind: 'kv', title: IPE_TITLE, rows: [
        ['Report', ipe.reportName],
        ['Source system', ipe.system],
        ['Transaction / report ref', ipe.reportRef],
        ['Parameters', ipe.parameters],
        ['Run by (client)', `${ipe.generatedBy} — ${ipe.generatedAt}`],
        ['Records', String(ipe.recordCount)],
        ['Control total', ipe.controlTotal],
        ['File', ipe.file?.name ?? '—'],
        ['Conclusion', ipe.conclusion === 'Not tested' ? 'Not tested' : `${ipe.conclusion}${ipe.testedBy ? ` — ${ipe.testedBy}, ${ipe.testedAt}` : ''}`],
      ],
    });
    blocks.push({
      kind: 'table', title: 'IPE — validation of the report',
      note: `${ipe.checks.filter(k => k.result === 'Pass').length}/${ipe.checks.length} checks passed · a report that does not conclude reliable cannot be sampled from`,
      // The proof is its own column. A finding written down and a finding
      // evidenced are not the same standard, and the reviewer reperforming this
      // needs to see which one they are reading.
      headers: ['', 'Check', 'Assertion proven', 'How it was proven', 'Finding', 'Proof on file', 'Tick'],
      rows: ipe.checks.map((k, i) => [String(i + 1), k.dimension, k.description, k.method, k.note ?? '—', k.evidence?.map(f => f.name).join('; ') || '—', tick(k.result)]),
      tickFrom: 6,
    });
  } else {
    blocks.push({ kind: 'note', label: 'IPE', text: 'No entity-produced report registered — the population has not been validated for source, completeness or accuracy.', tone: 'neutral' });
  }

  // To be tested — every attribute with its population and sample coverage
  blocks.push({
    kind: 'table', title: 'To be tested — attributes & coverage',
    note: pop ? `Population: ${pop.count} items from ${pop.source}${ipe ? ` · report ${ipe.conclusion.toLowerCase()}` : ''}` : 'No population drawn',
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
    const tally = combinedSample(c);
    blocks.push({
      kind: 'table', title: 'Details of samples tested',
      // The extension round is marked rather than merged silently: the combined
      // evaluation is what the conclusion rests on, and the reader has to be able
      // to see which items were the second bite.
      note: `${c.operating.sampling!.method}${c.operating.sampling!.seed ? ` (seed ${c.operating.sampling!.seed})` : ''} sample of ${samples.length}${tally.ext ? ` — ${tally.orig} original + ${tally.ext} drawn after an exception` : ''} — each item tested against every attribute`,
      headers: ['S.No', 'Sample', 'Round', ...steps.map((s, i) => `${letter(i)} · ${s.code}`)],
      rows: samples.map((smp, i) => [String(i + 1), smp.ref, smp.extension ? 'Extension' : 'Original', ...steps.map(s => tick(s.sampleResults?.[smp.id]))]),
      tickFrom: 3,
    });
  } else {
    blocks.push({ kind: 'note', label: 'Samples', text: 'No samples drawn — evidence is attribute-level (automated / full-population / attestation).', tone: 'neutral' });
  }

  // Results narrative + conclusion
  const d = trackResult(c.design); const o = trackResult(c.operating);
  const totalFails = steps.reduce((n, s) => n + samples.filter(smp => s.sampleResults?.[smp.id] === 'Fail').length, 0);
  // A short-form control's paper has to say WHY there is no operating test, or it
  // reads as a paper with a hole in it. The precondition is named too, because
  // that is the thing a reviewer would otherwise have to go and check.
  const opApplies = operatingApplies(eng, c);
  const results = [
    `TOD: ${d}${c.design.points.length ? ` — ${c.design.points.filter(p => (p.override?.result ?? p.result) === 'Pass').length}/${c.design.points.length} considerations satisfied` : ''}.`,
    opApplies
      ? `TOE: ${o}${steps.length ? ` — ${steps.length} attribute${steps.length === 1 ? '' : 's'} tested${samples.length ? ` across ${samples.length} samples, ${totalFails} exception${totalFails === 1 ? '' : 's'}` : ''}` : ''}.`
      : 'TOE: not applicable — the control is automated, so it performs identically on every transaction and the test of design is the whole test. Valid while the ITGCs behind it are effective; an ITGC failure puts the full population, sample and operating test back.',
    opApplies && c.operating.testedBy ? `Tested by ${c.operating.testedBy}, ${c.operating.testedAt}.` : '',
  ].filter(Boolean).join(' ');
  const concl = controlConclusion(c, opApplies);
  blocks.push({ kind: 'note', label: 'Test results', text: results, tone: concl === 'Effective' ? 'good' : concl === 'Ineffective' ? 'bad' : 'neutral' });
  blocks.push({ kind: 'note', label: 'Conclusion', text: `${concl} control`, tone: concl === 'Effective' ? 'good' : concl === 'Ineffective' ? 'bad' : 'neutral' });
  // The auditor's own words behind each track's conclusion. The box that collects
  // them says "retained in the working paper", so this is that promise being kept.
  const rationales = [
    c.design.rationale ? `TOD — ${c.design.rationale}` : '',
    c.operating.rationale ? `TOE — ${c.operating.rationale}` : '',
  ].filter(Boolean);
  if (rationales.length) blocks.push({ kind: 'note', label: 'Rationale', text: rationales.join(' '), tone: 'neutral' });

  // Linked exception, if the testing raised one
  if (def) {
    const a = assessSeverity(def, eng);
    // ─── PARKED (Aug 2026) — Priced impact ───────────────────────────────────
    // Recovery / working-capital unblock / leakage are internal-audit VALUE
    // metrics. ICFR asks what could have been misstated, which is a different
    // number. Restore with the Exposure rows parked inside the block below.
    //
    // const ex = def.exposure;
    blocks.push({
      kind: 'kv', title: `Exception — ${def.id}`, rows: [
        ['Description', def.description],
        // Where it was found and what kind of control broke — DERIVED from the
        // track that failed and the control's own nature, never asked. The
        // control is right here, so the paper states it rather than storing it.
        ['Gap nature', gapNature(def.track, c.nature)],
        // ─── PARKED (Aug 2026) — Gap type ────────────────────────────────────
        // The auditor used to classify this by hand (MDG / ITDG / TG). The
        // control's own RACM row already answers it, so asking again could only
        // produce a contradiction. Superseded by the derived row above.
        //
        // ['Gap type', def.gapType ? `${def.gapType} — ${GAP_LABEL[def.gapType]}` : '—'],
        ['Severity', a.bumped ? `${a.final} (prudent-official override)` : a.capped ? `${a.final} (capped from ${a.raw})` : a.final],
        // ─── PARKED (Aug 2026) — Priced impact ───────────────────────────────
        // What the gap is worth, split the way the source RACM splits it — an
        // internal-audit value metric, not an ICFR misstatement number.
        //
        // ['Exposure — total', ex ? formatINR(exposureTotal(ex)) : '—'],
        // ['Exposure — recovery / debit note', ex ? formatINR(ex.recovery) : '—'],
        // ['Exposure — working-capital unblock', ex ? formatINR(ex.workingCapital) : '—'],
        // ['Exposure — leakage', ex ? formatINR(ex.leakage) : '—'],
        // ['Exposure — basis', ex?.basis ?? '—'],
        ['Report reference', def.reportRef ?? c.reportRef ?? '—'],
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
  const order = ['Control', 'Sign-off', 'TOD', 'TOE', 'Results'] as const;
  const sectionOf = (b: PaperBlock): (typeof order)[number] => {
    if (b.kind === 'heading') return 'Control';
    if (b.kind === 'kv') {
      if (b.title === SIGNOFF_TITLE) return 'Sign-off';
      if (b.title === 'Control') return 'Control';
      if (b.title === 'Test legend' || b.title === IPE_TITLE) return 'TOE';
      // the walkthrough and the judgements are the design's own work, so they read
      // on the design tab beside the considerations they support
      if (b.title === WALKTHROUGH_TITLE || b.title === JUDGEMENTS_TITLE) return 'TOD';
      return 'Results'; // linked exception
    }
    if (b.kind === 'table') {
      if (b.title === 'TOD' || b.title === WALKTHROUGH_TABLE || b.title === DESIGN_ELEMENTS_TABLE) return 'TOD';
      // the programme is what the auditor was instructed to do, so it reads with
      // the control it belongs to rather than inside one track's results
      if (b.title === 'Audit programme — steps performed') return 'Control';
      return 'TOE';
    }
    if (b.label === 'Walkthrough') return 'TOD';
    return b.label === 'Samples' || b.label === 'IPE' ? 'TOE' : 'Results'; // notes
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
  const concl = controls.map(c => conclusionOf(eng, c));
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
          ['Period', periodLine(eng)],
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
          ['TOD concluded', String(controls.filter(c => trackResult(c.design) !== 'Not tested').length)],
          ['TOE concluded', String(controls.filter(c => trackResult(c.operating) !== 'Not tested').length)],
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
      headers: ['W/P', 'Control ID', 'Description', 'Process', 'Nature', 'Key', 'Control owner', 'Process owner', 'Root cause', 'TOD', 'Report (IPE)', 'TOE', 'TOE method', 'Conclusion', 'Conclusion rationale', 'Performed by', 'W/P hard copy', 'W/P soft copy', 'Report ref'],
      rows: controls.map(c => [c.wpRef, c.id, c.description, c.process, c.nature, c.isKey ? 'Yes' : 'No', c.owner, ownersOf(c).processOwner, c.rootCause ?? '—', trackResult(c.design), c.operating.ipe?.conclusion ?? 'Not registered', trackResult(c.operating), c.operating.method, controlConclusion(c),
        // one column, both tracks — the register answers "why does this read the
        // way it does" without opening the control's own paper
        [c.design.rationale && `TOD — ${c.design.rationale}`, c.operating.rationale && `TOE — ${c.operating.rationale}`].filter(Boolean).join(' ') || '—',
        c.performedBy ?? '—', c.wpRefHard ?? '—', c.wpRefSoft ?? '—', c.reportRef ?? '—']),
    }],
  };

  // Design testing — documents + considerations + conclusion
  const design: IcfrSheet = {
    name: 'TOD', blocks: [{
      kind: 'table', title: 'TOD', note: 'documents received · considerations ticked · conclusion per control',
      headers: ['W/P', 'Control ID', 'Documents received', 'Outstanding documents', 'Considerations passed', 'Conclusion', 'Rationale', 'Override', 'Tested by'],
      rows: controls.map(c => {
        const p = designProgress(c);
        return [c.wpRef, c.id, `${p.docsReceived}/${p.docsTotal}`, c.design.documents.filter(d => d.status !== 'Received').map(d => d.kind).join('; ') || 'None', `${p.pointsPass}/${p.pointsTotal}`, c.design.conclusion, c.design.rationale ?? '—', c.design.override ? `${c.design.override.result}: ${c.design.override.rationale}` : '—', c.design.testedBy ?? '—'];
      }),
    }],
  };

  // Operating testing — attribute-level (each attribute has its own workflow / attestation)
  const opRows = controls.flatMap(c => c.operating.steps.map(s => [c.wpRef, c.id, s.code, s.description, s.assertion, s.procedures.join('; '), s.workflowName ? `${s.workflowName}${s.workflowRunRef ? ` (${s.workflowRunRef})` : ''}` : '—', s.attestation?.by ?? '—', s.attestation?.note ?? '', s.attestation?.evidence.map(e => e.name).join('; ') ?? '', stepResult(s), s.override?.rationale ?? '']));
  const operating: IcfrSheet = {
    name: 'TOE', blocks: [{
      kind: 'table', title: 'TOE', note: `${opRows.length} attribute rows`,
      headers: ['W/P', 'Control ID', 'Attribute', 'Description', 'Assertion', 'Procedures', 'Workflow', 'Attested by', 'Attestation', 'Evidence', 'Result', 'Override rationale'],
      rows: opRows,
    }],
  };

  const deficiencies: IcfrSheet = {
    name: 'Deficiencies', blocks: [{
      kind: 'table', title: 'Deficiencies', note: defs.length ? `${defs.length} exception${defs.length === 1 ? '' : 's'}` : 'No exceptions raised',
      // The header and the row below are written one column per line and in the
      // same order, so a column parked here has its cell parked there — the two
      // lists must stay the same length or the sheet shears.
      headers: [
        'Deficiency', 'Control', 'Track',
        // Derived off the failed track and the control's nature — read-only.
        'Gap nature',
        'Description', 'Root cause', 'Likelihood', 'Magnitude', 'Materiality',
        'MW indicators', 'Compensating control', 'Severity',
        // ─── PARKED (Aug 2026) — Priced impact ───────────────────────────────
        // Recovery / working-capital unblock / leakage are internal-audit VALUE
        // metrics. ICFR asks what could have been misstated, which is a
        // different number.
        //
        // 'Recovery', 'Working capital', 'Leakage', 'Exposure total', 'Exposure basis',
        'Report ref', 'Remediation', 'Due', 'Status', 'Remediation evidence',
      ],
      rows: defs.map(d => {
        const a = assessSeverity(d, eng);
        const sev = a.bumped ? `${a.final} (prudent-official override)` : a.capped ? `${a.final} (capped from ${a.raw})` : a.final;
        const ctl = controls.find(x => x.id === d.controlId);
        // ─── PARKED (Aug 2026) — Priced impact ─────────────────────────────
        // const ex = d.exposure;
        return [
          d.id, d.controlId, d.track,
          ctl ? gapNature(d.track, ctl.nature) : '—',
          // ─── PARKED (Aug 2026) — Gap type ────────────────────────────────
          // Asked by hand (MDG / ITDG / TG) until the control's RACM row was
          // found to answer it already. Superseded by the derived cell above.
          //
          // d.gapType ? `${d.gapType} — ${GAP_LABEL[d.gapType]}` : '—',
          d.description, d.rootCause, d.likelihood, String(d.magnitude),
          formatINR(eng.materiality), d.mwIndicators.join('; ') || 'None',
          d.compensatingControlId ?? 'None', sev,
          // ─── PARKED (Aug 2026) — Priced impact ───────────────────────────
          // ex ? formatINR(ex.recovery) : '—',
          // ex ? formatINR(ex.workingCapital) : '—',
          // ex ? formatINR(ex.leakage) : '—',
          // ex ? formatINR(exposureTotal(ex)) : '—',
          // ex?.basis ?? '—',
          d.reportRef ?? '—', d.remediation.action, formatDueDate(d.remediation.date),
          d.remediation.status, d.remediation.evidence?.map(f => f.name).join('; ') || 'None',
        ];
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
