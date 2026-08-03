import * as XLSX from 'xlsx';
import {
  assessSeverity, controlConclusion, formatDueDate, formatINR, icfrConclusion,
  openMaterialWeaknesses, trackResult,
} from './helpers';
import { gapNature } from './types';
// ─── PARKED (Aug 2026) — Priced impact & Gap type ────────────────────────────
// Restore this import alongside the blocks parked further down the file.
//
// import { exposureTotal, GAP_LABEL } from './types';
import { periodLine, type IcfrSheet, type PaperBlock } from './icfrWorkingPaper';
import type { Control, Deficiency, IcfrEngagement } from './types';

/**
 * The audit report — the deliverable, which the working paper is not.
 *
 * The working paper is the evidence: what was tested, on what, and what it showed.
 * It is written for a reviewer and a regulator. Nobody in management reads it, and
 * on the review call that was said out loud — the paper is not the final output; a
 * report with a management action plan is, and this tool produced no such thing.
 *
 * So this is the same testing, addressed to the people who have to act on it:
 * what the group's controls do and don't cover, what broke, what it is worth in
 * rupees, and who has committed to fixing it by when. It is built from the SAME
 * `PaperBlock` union as the working paper, so the preview modal renders it and the
 * .xlsx writer exports it with no renderer of their own — one document format, two
 * documents.
 *
 * Nothing here is authored: every line is read off the controls, the deficiencies
 * and the sign-off. A report that could say something the working paper doesn't
 * would be a second version of the truth.
 */

export const REPORT_COVER_TITLE = 'Report — basis of issue';
export const MAP_TITLE = 'Management action plan';

/** Severity as the report states it, with the reason for any adjustment. */
function severityOf(d: Deficiency, eng: IcfrEngagement): string {
  const a = assessSeverity(d, eng);
  return a.bumped ? `${a.final} (raised on judgement)` : a.capped ? `${a.final} (capped from ${a.raw})` : a.final;
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
  const concl = controls.map(controlConclusion);
  const ineffective = concl.filter(x => x === 'Ineffective').length;
  const effective = concl.filter(x => x === 'Effective').length;
  const untested = concl.filter(x => x === 'Not started').length;
  const mwOpen = openMaterialWeaknesses(eng).length;
  // ─── PARKED (Aug 2026) — Priced impact ─────────────────────────────────────
  // Recovery / working-capital unblock / leakage are internal-audit VALUE
  // metrics. ICFR asks what could have been misstated, which is a different
  // number — so the report no longer puts a price on an observation.
  //
  // const exposure = defs.reduce((sum, d) => sum + exposureTotal(d.exposure), 0);
  const opinion = eng.signoff.icfrConclusion ?? icfrConclusion(eng);
  const signed = !!eng.signoff.preparer && !!eng.signoff.reviewer;
  const processes = [...new Set(controls.map(c => c.process))];
  const byControl = (id: string): Control | undefined => controls.find(c => c.id === id);

  const cover: IcfrSheet = {
    name: 'Cover', blocks: [
      { kind: 'heading', text: `Report on Internal Financial Controls — ${eng.entity}`, sub: `${eng.name} (${eng.code}) · ${eng.framework} · ${periodLine(eng)}` },
      {
        kind: 'kv', title: REPORT_COVER_TITLE, rows: [
          ['Entity', eng.entity],
          ['Engagement', `${eng.name} (${eng.code})`],
          ['Framework', eng.framework],
          ['Period covered', periodLine(eng)],
          ['Scope', `${controls.length} control${controls.length === 1 ? '' : 's'} across ${processes.length} process${processes.length === 1 ? '' : 'es'} — ${controls.filter(c => c.isKey).length} key`],
          ['Overall materiality', formatINR(eng.materiality)],
          ['Performance materiality', formatINR(eng.performanceMateriality)],
          ['Prepared by', eng.signoff.preparer ? `${eng.signoff.preparer.by} — ${eng.signoff.preparer.at}` : `${eng.preparer} — DRAFT, not yet signed`],
          ['Reviewed by', eng.signoff.reviewer ? `${eng.signoff.reviewer.by} — ${eng.signoff.reviewer.at}` : `${eng.reviewer} — DRAFT, not yet countersigned`],
          ['Status of this report', signed ? 'Issued — signed and countersigned' : 'DRAFT — issued only once the engagement is signed and countersigned'],
        ],
      },
      {
        kind: 'note', label: 'Basis', tone: 'neutral',
        text: 'This report states the conclusions of the ICFR testing performed for the period above. The evidence behind every conclusion — the design walkthroughs, the reports relied on and the samples tested — is in the working paper, which is referenced by the W/P column throughout and is not reproduced here.',
      },
    ],
  };

  const summary: IcfrSheet = {
    name: 'Executive summary', blocks: [
      {
        kind: 'note', label: 'Conclusion', tone: opinion === 'Effective' ? 'good' : opinion === 'Not effective' ? 'bad' : 'neutral',
        text: signed
          ? `${opinion} — internal financial controls over financial reporting, as at the end of the period.`
          : `${opinion} (indicative) — ${untested > 0 ? `${untested} control${untested === 1 ? '' : 's'} not yet tested; ` : ''}this conclusion is not final until the engagement is signed and countersigned.`,
      },
      {
        kind: 'kv', title: 'Where the testing landed', rows: [
          ['Controls in scope', String(controls.length)],
          ['Key controls', String(controls.filter(c => c.isKey).length)],
          ['Concluded effective', String(effective)],
          ['Concluded ineffective', String(ineffective)],
          ['Not yet tested', String(untested)],
          ['Observations raised', String(defs.length)],
          ['Material weaknesses open', String(mwOpen)],
          // ─── PARKED (Aug 2026) — Priced impact ─────────────────────────────
          // Read as "the number management acts on", but it is an internal-audit
          // value metric: severity already says what could have slipped through,
          // and what the gap cost the business is a different question this
          // report is not the place to answer.
          //
          // ['Priced impact — total', exposure > 0 ? formatINR(exposure) : 'Not priced'],
          // ['— recoverable', formatINR(defs.reduce((s, d) => s + (d.exposure?.recovery ?? 0), 0))],
          // ['— working capital released by the fix', formatINR(defs.reduce((s, d) => s + (d.exposure?.workingCapital ?? 0), 0))],
          // ['— leakage (not recoverable)', formatINR(defs.reduce((s, d) => s + (d.exposure?.leakage ?? 0), 0))],
        ],
      },
      {
        kind: 'table', title: 'By process',
        note: `${processes.length} process${processes.length === 1 ? '' : 'es'} in scope`,
        // Header and row are one column per line, in step — park a column here
        // and its cell below, or the sheet shears.
        headers: [
          'Process', 'Controls', 'Key', 'Effective', 'Ineffective', 'Not tested', 'Observations',
          // ─── PARKED (Aug 2026) — Priced impact ───────────────────────────
          // An internal-audit VALUE metric. ICFR asks what could have been
          // misstated, which is a different number.
          //
          // 'Priced impact',
        ],
        rows: processes.map(p => {
          const inP = controls.filter(c => c.process === p);
          const pDefs = defs.filter(d => inP.some(c => c.id === d.controlId));
          // ─── PARKED (Aug 2026) — Priced impact ─────────────────────────────
          // const pExposure = pDefs.reduce((s, d) => s + exposureTotal(d.exposure), 0);
          return [
            p, String(inP.length), String(inP.filter(c => c.isKey).length),
            String(inP.filter(c => controlConclusion(c) === 'Effective').length),
            String(inP.filter(c => controlConclusion(c) === 'Ineffective').length),
            String(inP.filter(c => controlConclusion(c) === 'Not started').length),
            String(pDefs.length),
            // ─── PARKED (Aug 2026) — Priced impact ───────────────────────────
            // pExposure > 0 ? formatINR(pExposure) : '—',
          ];
        }),
      },
    ],
  };

  const observations: IcfrSheet = {
    name: 'Observations', blocks: defs.length ? [
      {
        kind: 'table', title: 'Observations',
        note: `${defs.length} observation${defs.length === 1 ? '' : 's'} · ordered as they appear in the report`,
        // Header and row are one column per line, in step — park a column here
        // and its cell below, or the sheet shears.
        headers: [
          'Report ref', 'W/P', 'Control', 'What we found', 'Why it happened',
          // Derived off the failed track and the control's nature — read-only.
          'Gap nature',
          'Severity',
          // ─── PARKED (Aug 2026) — Priced impact ───────────────────────────
          // An internal-audit VALUE metric. ICFR asks what could have been
          // misstated, which is a different number.
          //
          // 'Priced impact',
          'Standing',
        ],
        rows: [...defs]
          .sort((a, b) => (a.reportRef ?? 'zz').localeCompare(b.reportRef ?? 'zz'))
          .map(d => {
            const c = byControl(d.controlId);
            return [
              d.reportRef ?? '—',
              c?.wpRef ?? '—',
              c ? `${c.id} — ${c.description}` : d.controlId,
              d.description,
              d.rootCause,
              c ? gapNature(d.track, c.nature) : '—',
              // ─── PARKED (Aug 2026) — Gap type ────────────────────────────
              // Asked by hand (MDG / ITDG / TG) until the control's RACM row
              // was found to answer it already. Superseded by the cell above.
              //
              // d.gapType ? `${d.gapType} — ${GAP_LABEL[d.gapType]}` : '—',
              severityOf(d, eng),
              // ─── PARKED (Aug 2026) — Priced impact ──────────────────────
              // d.exposure ? formatINR(exposureTotal(d.exposure)) : 'Not priced',
              observationStatus(d),
            ];
          }),
      },
      {
        kind: 'note', label: 'Reading this', tone: 'neutral',
        text: 'Gap nature says where the failure was found and what kind of control broke. It is read off the control’s own RACM row and the track that failed, never asked again: a design gap means the control as built cannot do the job; an operating failure means the design is sound but the control did not run as designed. Severity answers the separate question of what could have gone through undetected, measured against materiality.',
      },
      // ─── PARKED (Aug 2026) — Gap type & Priced impact ────────────────────
      // The note above used to explain the hand-typed MDG / ITDG / TG labels and
      // the rupee value of each observation. Both are gone from the report.
      //
      // {
      //   kind: 'note', label: 'Reading this', tone: 'neutral',
      //   text: 'Gap type says where the failure was found and what kind of thing broke: a design gap means the control as built cannot do the job, whether because a person cannot (MDG) or because the system does not enforce it (ITDG); a testing gap (TG) means the design is sound but the control did not operate. Severity answers what could have gone through undetected; priced impact answers what it actually cost.',
      // },
    ] : [
      { kind: 'note', label: 'Observations', tone: 'good', text: 'No observations were raised. Every control tested concluded effective in both design and operation.' },
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

  const appendix: IcfrSheet = {
    name: 'Appendix', blocks: [
      {
        kind: 'table', title: 'Appendix — controls tested',
        note: `${controls.length} control${controls.length === 1 ? '' : 's'} · the working paper reference for each`,
        headers: ['W/P', 'Control', 'Objective', 'Process', 'Class', 'Key', 'Risk rating', 'Frequency', 'Design', 'Report (IPE)', 'Operating', 'Conclusion', 'Performed by', 'Report ref'],
        rows: controls.map(c => [
          c.wpRef,
          `${c.id} — ${c.description}`,
          c.objective ?? '—',
          c.process,
          c.clazz ?? '—',
          c.isKey ? 'Key' : 'Non-key',
          c.riskRating ?? 'Not rated',
          c.frequency,
          trackResult(c.design),
          c.operating.ipe?.conclusion ?? 'No report registered',
          trackResult(c.operating),
          controlConclusion(c),
          c.performedBy ?? '—',
          c.reportRef ?? '—',
        ]),
      },
      {
        kind: 'kv', title: 'Definitions used in this report', rows: [
          ['Key control', 'A control relied on to prevent or detect a material misstatement. Agreed with management, not derived from the procedure.'],
          ['Test of design', 'Whether the control, as built, can address the risk — proved by walking one live transaction against every attribute.'],
          ['Test of operating effectiveness', 'Whether it did address the risk across the period — proved by a sample sized on the control’s frequency and its risk rating.'],
          ['IPE', 'Information produced by the entity. A report the client ran is tested for source, completeness and accuracy before anything is sampled from it.'],
          ['Severity', 'Likelihood × magnitude against materiality, with the material-weakness indicators applied.'],
          ['Gap nature', 'What kind of control broke and on which track — derived from the control’s nature on the RACM and the track that failed, not stated by the auditor.'],
          // ─── PARKED (Aug 2026) — Priced impact ─────────────────────────────
          // An internal-audit VALUE metric. ICFR asks what could have been
          // misstated, which is a different number — so nothing in this report
          // prices an observation any more and the definition has no referent.
          //
          // ['Priced impact', 'What the gap is worth: recoverable amounts, working capital the fix releases, and leakage that is gone.'],
        ],
      },
    ],
  };

  return [cover, summary, observations, map, appendix];
}

/** The report as a workbook — one sheet per section, same blocks the preview shows. */
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
