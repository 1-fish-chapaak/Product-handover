import * as XLSX from 'xlsx';
import {
  conclusionOf, designStarted, formatDueDate, formatINR, gradeException,
  icfrConclusion, openMaterialWeaknesses, trackResult,
} from './helpers';
import { periodLine, type IcfrSheet, type PaperBlock } from './icfrWorkingPaper';
import type { Control, Deficiency, IcfrEngagement } from './types';

/**
 * The audit report — the deliverable, which the working paper is not.
 *
 * The working paper is the evidence: what was tested, on what, and what it
 * showed — written for a reviewer and a regulator. This is the same testing
 * addressed to the people who act on it, and its shape follows the client's own
 * end-of-audit summary report (the P2P SOX Control Testing example, Aug 2026):
 *
 *   Summary → Control Rollup → Exceptions → Deficiency Severity
 *
 * plus the Management action plan, kept on the user's call — the review call
 * named a report with a MAP as the engagement's real output, so the example's
 * four sheets gained a fifth rather than losing it.
 *
 * The report is issued as a PDF (each sheet becomes a page); preview and an
 * .xlsx export read the same sheets, so the three can never disagree. Nothing
 * here is authored: every line is read off the controls, the deficiencies and
 * the sign-off. A report that could say something the working paper doesn't
 * would be a second version of the truth.
 *
 * (The earlier narrative format — Cover / Executive summary / Observations /
 * Appendix — and its parked Priced-impact & Gap-type columns live in git
 * history, superseded by this sheet layout.)
 */

export const MAP_TITLE = 'Management action plan';

/** The TOE grid in numbers — the handbook grain is attribute × sampled item,
 *  so "checks" here means exactly the cells of that grid. */
function checkCounts(c: Control): { items: number; done: number; total: number; fails: number } {
  const samples = c.operating.sampling?.samples ?? [];
  const steps = c.operating.steps;
  let done = 0, fails = 0;
  steps.forEach(s => samples.forEach(smp => {
    const r = s.sampleResults?.[smp.id];
    if (r && r !== 'Not tested') done += 1;
    if (r === 'Fail') fails += 1;
  }));
  return { items: samples.length, done, total: steps.length * samples.length, fails };
}

/** The rollup's Testing cell — completion of the attribute grid, as a share. */
function testingCell(k: ReturnType<typeof checkCounts>): string {
  if (k.total === 0) return 'Not started';
  return `${Math.round((k.done / k.total) * 100)}%`;
}

/** Readiness is the design test's standing: TOD gates TOE, so a control whose
 *  design has not held up is not ready to be operated on a sample at all. */
function readiness(c: Control): string {
  const d = trackResult(c.design);
  if (d === 'Effective') return 'Ready';
  if (d === 'Ineffective') return 'Design gap';
  return designStarted(c) ? 'In progress' : 'Not assessed';
}

/** Where the control's paper stands with the reviewer. Caps mark the states
 *  where nothing has been granted yet, the way the sheet's reader scans for. */
function reviewCell(c: Control): string {
  if (c.wpSignoff?.reviewer) return 'Signed off';
  if (c.wpSignoff?.preparer) return 'PENDING REVIEW';
  if (c.reviewReturn) return 'RETURNED';
  return 'NOT SUBMITTED';
}

const GRADE_RANK: Record<string, number> = {
  'Clearly Trivial': 0, Deficiency: 1, 'Significant Deficiency': 2, 'Material Weakness': 3,
};

/** The grade as the report states it, with the reason for any adjustment. */
function gradeLabel(d: Deficiency, eng: IcfrEngagement): string {
  const g = gradeException(d, eng);
  return g.bumped ? `${g.grade} (raised on judgement)`
    : g.cap ? `${g.grade} (capped from ${g.cap.from})`
    : g.grade;
}

/** The worst grade among a control's deficiencies — the rollup's Severity cell. */
function worstGrade(defs: Deficiency[], eng: IcfrEngagement): string {
  if (!defs.length) return '—';
  return defs
    .map(d => gradeException(d, eng).grade)
    .reduce((a, b) => (GRADE_RANK[b] > GRADE_RANK[a] ? b : a));
}

/** Plain-English standing of one observation, for a reader who doesn't know the
 *  exception lifecycle's vocabulary. */
function observationStatus(d: Deficiency): string {
  if (d.status === 'Closed') return 'Closed — retested and accepted';
  if (d.status === 'Awaiting reviewer') return 'Retested, awaiting reviewer close';
  if (d.status === 'Retest') return 'Fix submitted — retest in progress';
  if (d.status === 'Remediation') return 'Action agreed — fix in progress';
  return 'Open — action not yet agreed';
}

export function buildAuditReport(eng: IcfrEngagement, controls: Control[] = eng.controls): IcfrSheet[] {
  const ids = new Set(controls.map(c => c.id));
  const defs = eng.deficiencies.filter(d => ids.has(d.controlId));
  const concl = controls.map(c => conclusionOf(eng, c));
  const untested = concl.filter(x => x === 'Not started').length;
  const mwOpen = openMaterialWeaknesses(eng).length;
  // Off the LIVE audit's record, like the working paper and the lock — the
  // engagement-level signoff field is never written, so reading it kept this
  // report a permanent draft whatever the reviewer had signed.
  const liveSignoff = eng.audits.find(a => !a.archive)?.signoff ?? {};
  const opinion = liveSignoff.icfrConclusion ?? icfrConclusion(eng);
  const signed = !!liveSignoff.preparer && !!liveSignoff.reviewer;
  const byControl = (id: string): Control | undefined => controls.find(c => c.id === id);

  const counts = controls.map(checkCounts);
  const items = counts.reduce((s, k) => s + k.items, 0);
  const done = counts.reduce((s, k) => s + k.done, 0);
  const total = counts.reduce((s, k) => s + k.total, 0);
  const fails = counts.reduce((s, k) => s + k.fails, 0);
  const grades = defs.map(d => gradeException(d, eng).grade);
  const tally = (g: string) => grades.filter(x => x === g).length;

  const summary: IcfrSheet = {
    name: 'Summary', blocks: [
      { kind: 'heading', text: `Audit report — ${eng.entity}`, sub: `${eng.name} (${eng.code}) · ${eng.framework} · ${periodLine(eng)}` },
      {
        kind: 'kv', title: 'Engagement', rows: [
          ['Engagement', `${eng.name} (${eng.code})`],
          ['Framework', eng.framework],
          ['Entity', eng.entity],
          ['Audit period', periodLine(eng)],
          ['Preparer / Reviewer', `${liveSignoff.preparer?.by ?? eng.preparer} / ${liveSignoff.reviewer?.by ?? eng.reviewer}`],
          ['Materiality', formatINR(eng.materiality)],
          ['Report status', signed ? 'Issued — signed and countersigned' : 'DRAFT — issued only once the audit is signed and countersigned'],
        ],
      },
      {
        kind: 'note', label: 'Opinion', tone: opinion === 'Effective' ? 'good' : opinion === 'Not effective' ? 'bad' : 'neutral',
        text: signed
          ? `${opinion} — internal financial controls over financial reporting, as at the end of the period.`
          : `${opinion} (indicative) — ${untested > 0 ? `${untested} control${untested === 1 ? '' : 's'} not yet tested; ` : ''}this conclusion is not final until the audit is signed and countersigned.`,
      },
      {
        kind: 'kv', title: 'Testing at a glance', rows: [
          ['Controls in scope', String(controls.length)],
          ['Key controls', String(controls.filter(c => c.isKey).length)],
          ['Test items', String(items)],
          ['Attribute checks completed', total === 0 ? 'None defined yet' : `${done}/${total} (${Math.round((done / total) * 100)}%)`],
          ['Failed checks', String(fails)],
        ],
      },
      {
        kind: 'kv', title: 'Conclusions', rows: [
          ['Effective', String(concl.filter(x => x === 'Effective').length)],
          ['Ineffective', String(concl.filter(x => x === 'Ineffective').length)],
          ['In progress', String(concl.filter(x => x === 'In progress').length)],
          ['Not yet tested', String(untested)],
        ],
      },
      {
        kind: 'kv', title: 'Deficiency severity', rows: [
          ['Material weaknesses', String(tally('Material Weakness'))],
          ['Significant deficiencies', String(tally('Significant Deficiency'))],
          ['Deficiencies', String(tally('Deficiency'))],
          ['Clearly trivial', String(tally('Clearly Trivial'))],
        ],
      },
    ],
  };

  const rollup: IcfrSheet = {
    name: 'Control Rollup', blocks: [
      {
        kind: 'table', title: 'Control rollup',
        note: `${controls.length} control${controls.length === 1 ? '' : 's'} — one row per control, from readiness to conclusion`,
        headers: ['Control ID', 'Control', 'Readiness', 'Test items', 'Testing', 'Failed checks', 'Review', 'Conclusion', 'Severity', 'Finalized by'],
        rows: controls.map((c, i) => {
          const k = counts[i];
          return [
            c.id,
            c.description,
            readiness(c),
            String(k.items),
            testingCell(k),
            String(k.fails),
            reviewCell(c),
            conclusionOf(eng, c),
            worstGrade(defs.filter(d => d.controlId === c.id), eng),
            c.wpSignoff?.reviewer?.by ?? '—',
          ];
        }),
      },
      {
        kind: 'note', label: 'Reading this', tone: 'neutral',
        text: 'Readiness is the design test: a control whose design has not held up is not ready to be operated on a sample. Testing is the share of attribute checks completed across the drawn items. Review is where the control’s working paper stands with the reviewer, and Finalized by names the reviewer who countersigned it. Severity is the worst grade among the control’s deficiencies.',
      },
    ],
  };

  const exceptionRows: string[][] = controls.flatMap(c => {
    const samples = c.operating.sampling?.samples ?? [];
    return c.operating.steps.flatMap(s => samples
      .filter(smp => s.sampleResults?.[smp.id] === 'Fail')
      .map(smp => [
        c.id,
        smp.ref,
        s.code,
        s.description,
        s.assertion,
        s.aiValidation ? 'AI validation' : 'Manual testing',
        defs.find(d => d.controlId === c.id && d.failedSamples?.includes(smp.ref))?.description
          ?? defs.find(d => d.controlId === c.id && d.track === 'operating')?.description
          ?? '—',
      ]));
  });
  const exceptions: IcfrSheet = {
    name: 'Exceptions', blocks: exceptionRows.length ? [
      {
        kind: 'table', title: 'Exceptions',
        note: `${exceptionRows.length} failed check${exceptionRows.length === 1 ? '' : 's'} — one row per failed attribute per sampled item`,
        headers: ['Control', 'Sample', 'Attribute', 'Attribute name', 'Assertion', 'Source', 'Notes'],
        rows: exceptionRows,
      },
      {
        kind: 'note', label: 'Reading this', tone: 'neutral',
        text: 'These rows come straight off the TOE grid. A design gap has no sampled item to point at, so it does not appear here — it is graded under Deficiency Severity and carried on the action plan like any other finding.',
      },
    ] : [
      { kind: 'note', label: 'Exceptions', tone: 'good', text: 'No failed checks — every attribute tested passed on every sampled item.' },
    ],
  };

  const defSeverity: IcfrSheet = {
    name: 'Deficiency Severity', blocks: [
      {
        kind: 'table', title: 'Deficiency severity',
        note: defs.length ? `${defs.length} deficienc${defs.length === 1 ? 'y' : 'ies'} · graded by the engine, confirmed by a second pair of eyes` : 'Nothing classified',
        headers: ['Control', 'Severity', 'Likelihood', 'Magnitude', 'Materiality', 'MW indicators', 'Rationale', 'Classified by', 'Classified at'],
        rows: defs.length ? defs.map(d => [
          d.controlId,
          gradeLabel(d, eng),
          d.likelihood,
          formatINR(d.magnitude),
          formatINR(eng.materiality),
          d.mwIndicators.length ? d.mwIndicators.join('; ') : '—',
          d.rootCause,
          d.ratingConfirm?.by ?? d.sized?.by ?? '—',
          d.ratingConfirm?.at ?? d.sized?.at ?? '—',
        ]) : [
          // the example report's own empty state: a placeholder row, not a blank sheet
          ['—', 'No deficiency severity classifications recorded', '—', '—', formatINR(eng.materiality), '—', '—', '—', '—'],
        ],
      },
      {
        kind: 'note', label: 'Reading this', tone: 'neutral',
        text: 'Severity is never typed by hand: likelihood × magnitude against materiality, the material-weakness indicators, the compensating-control cap and any recorded judgement — one engine, so this sheet cannot disagree with the register. Classified by names the reviewer who confirmed the grade, or the auditor who sized it where confirmation is still pending.',
      },
    ],
  };

  const actionable = defs.filter(d => d.status !== 'Closed');
  const map: IcfrSheet = {
    name: MAP_TITLE, blocks: [
      {
        kind: 'note', label: MAP_TITLE, tone: 'neutral',
        text: 'The actions below are management’s, not the audit team’s: each is the fix the control owner has committed to, with the date they committed to. The audit team retests the fix and states the outcome in the last column — a fix is not closed because it was delivered, it is closed because a fresh sample proved it.',
      },
      {
        kind: 'table', title: 'Agreed actions',
        note: defs.length ? `${actionable.length} open of ${defs.length} observation${defs.length === 1 ? '' : 's'}` : 'Nothing to remediate',
        headers: ['Report ref', 'Observation', 'Agreed action', 'Owner', 'Committed date', 'Progress', 'Retest', 'Standing'],
        rows: defs.map(d => [
          d.reportRef ?? '—',
          d.description,
          d.remediation.action?.trim() || 'NOT YET AGREED',
          d.remediation.owner || byControl(d.controlId)?.owner || '—',
          formatDueDate(d.remediation.date),
          d.remediation.status,
          d.retest ? `${d.retest.result} — ${d.retest.by}, ${d.retest.at}` : 'Not retested',
          observationStatus(d),
        ]),
      },
      ...(mwOpen > 0 ? [{
        kind: 'note', label: 'Material weakness', tone: 'bad',
        text: `${mwOpen} material weakness${mwOpen === 1 ? '' : 'es'} remain open. A material weakness cannot be cleared by a remediation plan alone — it stays open until a fresh sample over the post-fix period passes.`,
      } as PaperBlock] : []),
    ],
  };

  return [summary, rollup, exceptions, defSeverity, map];
}

/** The report as a workbook — one sheet per section, same blocks the preview
 *  shows and the PDF pages. The .xlsx keeps this sheet-per-section format; the
 *  PDF (the primary issue format) turns each sheet into a page. */
export function downloadAuditReport(eng: IcfrEngagement, controls: Control[] = eng.controls): void {
  const wb = XLSX.utils.book_new();
  for (const sheet of buildAuditReport(eng, controls)) {
    const aoa: (string | number)[][] = [];
    sheet.blocks.forEach(b => {
      if (b.kind === 'heading') { aoa.push([b.text], [b.sub]); }
      else if (b.kind === 'kv') { if (b.title) aoa.push([b.title.toUpperCase()]); b.rows.forEach(r => aoa.push([...r])); }
      else if (b.kind === 'table') { aoa.push([b.title.toUpperCase()]); if (b.note) aoa.push([b.note]); aoa.push(b.headers, ...b.rows); }
      else { aoa.push([b.label.toUpperCase(), b.text]); }
      aoa.push([]);
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = colWidths(aoa);
    if (sheet.blocks[0]?.kind === 'heading') ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }];
    // sheet names cannot exceed 31 chars in xlsx
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }
  XLSX.writeFile(wb, `Audit_Report_ICFR_${eng.code}.xlsx`);
}

function colWidths(rows: (string | number)[][], max = 90): XLSX.ColInfo[] {
  const w: number[] = [];
  rows.forEach(r => r.forEach((c, i) => { w[i] = Math.min(max, Math.max(w[i] ?? 10, String(c ?? '').length + 2)); }));
  return w.map(wch => ({ wch }));
}
