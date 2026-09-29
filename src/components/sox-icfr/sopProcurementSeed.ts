/**
 * THE BIG SOP DRAFT — Procure to Pay, read out of the real procurement RACM.
 *
 * The user's ask (29 Sep): "I want to see the fishbone chart flowchart for at
 * least 10 controls and risks so that I know what it will look like."
 *
 * Every other process drafts five controls, because `racmTemplate` takes
 * `titles.slice(0, 5)`. Five boxes say nothing about how a fishbone behaves at
 * the size a real SOP produces — which is the only reason this file exists.
 *
 * WHY THIS DATA AND NOT INVENTED CONTENT. `src/data/procurement-racm.ts` holds
 * 124 risk-control rows generated from an actual procurement SOP workbook, and
 * it already carries the two things an SOP extraction is supposed to produce and
 * nothing else in this prototype has: its own section references
 * ("SOP-PROC-001, Section 5.2.2"), and a `confidence` telling what was read from
 * the document apart from what was proposed on top of it. Writing twelve
 * believable procurement risks by hand when twelve true ones are already in the
 * repo would have been the worse of the two, and the user picked this one.
 *
 * WHICH TWELVE. The SOP divides itself into phases — budget, requisition,
 * sourcing, PO, receipt, invoice, payment, close-out, governance. One control
 * from each, in the document's own order, so the spine reads as the process
 * actually runs; then the rows the source marks RECOMMENDED, which are exactly
 * what point 7 of the prompt asks Ira to add, so they arrive as
 * `origin: 'suggested'` and the chart shows both states.
 *
 * Each row carries one risk of its own, so twelve rows are twelve ribs. That is
 * this document's shape rather than a choice made here: the source has 124
 * distinct Risk IDs across 124 rows.
 *
 * WHAT IS DERIVED, AND WHY IT IS NOT AN INVENTION. One thing only: the source
 * has no Control title column — just the full activity — so the title is the
 * activity's first sentence, which is the same fallback `spineControl` already
 * draws the box with. Nothing else is computed. A field the source leaves empty
 * is left empty, and Review's own "Ira fills the blanks" answers it exactly as
 * it does for every other SOP draft — including Risk owner, which every SOP
 * draft in this product asks the reviewer for.
 *
 * ROWS THE READER WOULD CHOKE ON ARE NOT OFFERED. A drafted row that arrives
 * already blocked would sit in Review unable to import, which is the opposite of
 * the point. So a row is skipped when `parseType` cannot read its type (the
 * source's eight Corrective rows), when `parseFrequency` cannot read its
 * frequency ("Per Batch", "Per Change", "Continuous"), or when none of its
 * assertions land — the source writes Authorization, Validity, Timeliness,
 * Security and Compliance, and this product's matrix is CEAVOP. Mapping those
 * across would be a change to `ASSERTION_CELL` that every upload would feel, so
 * it is not made here on the quiet.
 *
 * That filter costs two phases outright, Key Controls and Exception Handling,
 * and nine remain. `isKey` is nobody's to derive — `procurement-racm` says on
 * its own Key control column that it is a judgement the auditor records — so
 * every row arrives unticked.
 */
import {
  draftRowsFromSop, parseAssertions, parseFrequency, readPromptRules, rowFromValues,
  type ImportRow, type RacmFieldKey,
} from './racmImport';
import { PROCUREMENT_RACM_ROWS, type ProcurementRacmRow } from '../../data/procurement-racm';
import type { Control, Nature } from './types';

/** The one process this seed speaks for. Everything else keeps its template. */
const PROCESS = 'Procure to Pay';

/** Twelve is the smallest number that answers "at least 10" on both counts and
 *  still fits the eleven phases the document has, one apiece plus Ira's own. */
const TARGET = 12;

/** A phase is the part of a sub-process before the step — "Payment Processing -
 *  Payment Run" is the Payment Processing phase. Eleven of them, and they are
 *  what the Review screen groups by and the spine orders on. */
const phaseOf = (r: ProcurementRacmRow): string => String(r.subProcess ?? '').split(' - ')[0]!.trim();

/** The source spells nature its own way; these are the three the product has. */
const NATURE_OF: Record<string, Nature> = {
  'Manual': 'Manual',
  'Automated': 'Automated',
  'IT-Dependent Manual': 'IT-dependent',
};

/** A heading for a statement whose only text is the statement — the same rule
 *  `sopSpine` uses to title a risk that arrived without one. */
function firstSentence(text: string): string {
  const t = String(text ?? '').trim();
  if (!t) return '';
  const stop = t.search(/[.;]\s|\n/);
  const head = stop > 0 ? t.slice(0, stop) : t;
  return head.length > 110 ? `${head.slice(0, 109).trimEnd()}…` : head;
}

/** Can the import reader take this row as it stands? See the header. */
const usable = (r: ProcurementRacmRow): boolean =>
  (r.controlType === 'Preventive' || r.controlType === 'Detective')
  && !!NATURE_OF[r.controlNature]
  && parseFrequency(r.frequency).frequency !== null
  && parseAssertions(r.assertions).length > 0;

/** Does this seed answer for `process`? */
export const hasProcurementSop = (process: string): boolean =>
  process.trim().toLowerCase() === PROCESS.toLowerCase();

/**
 * The rows to draft, in the order the document puts them.
 *
 * TWELVE OF THE SOP'S OWN, and Ira's proposals ON TOP rather than inside that
 * count. A suggestion arrives unticked — that is the whole point of one — so
 * folding them into the twelve would have left the chart drawing nine until
 * somebody accepted the rest, which is not the size this seed exists to show.
 *
 * Breadth first, depth second: one control from each phase, then a second from
 * each, and so on. Taking twelve in file order would have spent them all inside
 * budgeting and requisition and never reached payment.
 *
 * The prompt still decides. Its narrowings filter the pool before the walk, the
 * same way `draftRowsFromSop` filters its template.
 */
function chooseRows(rules: ReturnType<typeof readPromptRules>): ProcurementRacmRow[] {
  const pool = PROCUREMENT_RACM_ROWS.filter(r =>
    usable(r)
    // This document designates no key controls, so "key controls only" narrows
    // to nothing at all. An empty draft says that; drafting twelve anyway would
    // be reading the instruction and then ignoring it.
    && !rules.keyOnly
    && (!rules.types.length || rules.types.includes(r.controlType as 'Preventive' | 'Detective'))
    && (!rules.natures.length || rules.natures.includes(NATURE_OF[r.controlNature]!)));

  const phases: string[] = [];
  const byPhase = new Map<string, ProcurementRacmRow[]>();
  for (const r of pool) {
    if (r.confidence === 'RECOMMENDED') continue;
    const p = phaseOf(r);
    if (!byPhase.has(p)) { byPhase.set(p, []); phases.push(p); }
    byPhase.get(p)!.push(r);
  }

  const cap = Math.max(0, Math.min(rules.limit ?? TARGET, TARGET));
  const stated: ProcurementRacmRow[] = [];
  const deepest = Math.max(0, ...[...byPhase.values()].map(rs => rs.length));
  for (let n = 0; n < deepest && stated.length < cap; n++) {
    for (const p of phases) {
      if (stated.length >= cap) break;
      const r = byPhase.get(p)![n];
      if (r) stated.push(r);
    }
  }
  // Point 7 of the prompt. Taken out of the prompt, Ira stops offering them —
  // and these are the rows the source itself marks as proposals.
  const proposed = rules.suggestExtras ? pool.filter(r => r.confidence === 'RECOMMENDED') : [];
  // Chosen breadth-first, read back in the SOP's own order — Review lists rows
  // in the order they were drafted, and a reviewer following the document should
  // not be sent back to budgeting after reaching payment. Ira's proposals stay
  // at the end, where an addition belongs.
  const at = new Map(PROCUREMENT_RACM_ROWS.map((r, i) => [r, i]));
  stated.sort((a, b) => at.get(a)! - at.get(b)!);
  return [...stated, ...proposed];
}

/** The draft for a Procure to Pay SOP. Same shape `draftRowsFromSop` returns. */
export function draftProcurementSopRows(
  fileName: string, prompt: string, existing: Control[], entity = '',
): ImportRow[] {
  void fileName;
  const rules = readPromptRules(prompt);
  const out: ImportRow[] = [];

  chooseRows(rules).forEach((r, i) => {
    const suggested = r.confidence === 'RECOMMENDED';
    // A suggestion has no section to cite — the SOP never described it.
    const sectionRef = !suggested && rules.citeSections ? (r.sopSectionRef || undefined) : undefined;
    const values: Partial<Record<RacmFieldKey, string>> = {
      riskId: r.riskId,
      riskDescription: r.riskDescription,
      riskCategory: r.riskCategory,
      riskRating: r.riskRating,
      likelihood: r.likelihood,
      controlId: r.controlId,
      controlTitle: r.controlTitle || firstSentence(r.controlActivity),
      objective: r.controlObjective,
      controlActivity: r.controlActivity,
      subProcess: phaseOf(r),
      type: r.controlType,
      nature: r.controlNature,
      frequency: r.frequency,
      // Not derived from anything. Which controls are key is a judgement the
      // auditor records — `procurement-racm` says so on its own Key control
      // column — and no SOP states it, so every row arrives unticked and Review
      // is where it gets decided.
      isKey: 'No',
      owner: r.controlOwner,
      processOwner: r.processOwner,
      assertions: r.assertions,
      attributes: rules.listAttributes ? r.attributes : '',
      controlEvidence: rules.listAttributes ? r.controlEvidence : '',
      designChecks: r.designChecks,
      sopSectionRef: sectionRef ?? '',
    };
    out.push(rowFromValues(
      values,
      { key: `sop-${i + 1}`, rowNo: i + 1, origin: suggested ? 'suggested' : 'sop', sectionRef },
      existing, PROCESS, out, entity,
    ));
  });
  return out;
}

/**
 * The SOP draft for any process — this seed where it has one, the per-process
 * template everywhere else.
 *
 * One door, so the chart beside the prompt and the draft the extraction lands
 * can never be built by two different readers.
 */
export function draftSopRows(
  process: string, fileName: string, prompt: string, existing: Control[], entity = '',
): ImportRow[] {
  return hasProcurementSop(process)
    ? draftProcurementSopRows(fileName, prompt, existing, entity)
    : draftRowsFromSop(process, fileName, prompt, existing, entity);
}
