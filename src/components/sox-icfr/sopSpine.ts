/**
 * THE PROCESS SPINE READ OUT OF AN SOP — sub-processes, their order, the risks
 * in each and the controls against them.
 *
 * WHAT THIS FILE MUST NEVER DO IS WRITE A PROCESS NARRATIVE (29 Sep). It used
 * to. The rule that stopped it is worth keeping in front of whoever reads this
 * next:
 *
 *   A difference between the SOP and the actual process is itself a finding.
 *   Either the process changed and the SOP was never updated, or people are not
 *   following the SOP. Both are reportable.
 *
 * A narrative generated from the SOP can never differ from it, so that finding
 * can never surface, and the walkthrough stops proving anything — it would be
 * checking a document against the source it was copied from. The narrative's
 * source is the interview and the walkthrough, with the SOP only a reference
 * during that conversation. There is no such input here, so there is no
 * narrative here.
 *
 * What an SOP CAN be read for, and what this file returns:
 *
 *   the spine       the sub-process list, in order. Structural, stated by the
 *                   document, stable year to year — generated outright.
 *   the flowchart   a DRAFT only. An SOP gives the order of steps, the roles,
 *                   the systems and the decision points; it does not give where
 *                   the control actually sits, the workarounds the process has
 *                   grown, or the override routes used routinely. So what is
 *                   drawn off this spine is marked SOP-derived and unconfirmed,
 *                   and the auditor confirms or corrects it after the
 *                   walkthrough.
 *
 * Nothing below invents prose. Every field comes off a draft row, and a row
 * missing a field yields less rather than a guess.
 */
import type { ImportRow, RacmFieldKey } from './racmImport';

const cell = (row: ImportRow, key: RacmFieldKey) => String(row.values[key] ?? '').trim();


/** The first sentence of a longer statement — a heading for a risk whose only
 *  text is its description. */
function firstSentence(text: string): string {
  const t = text.trim();
  if (!t) return '';
  const stop = t.search(/[.;]\s|\n/);
  const head = stop > 0 ? t.slice(0, stop) : t;
  return head.length > 90 ? `${head.slice(0, 89).trimEnd()}…` : head;
}


// ─── The shared spine ────────────────────────────────────────────────────────

/** One risk and the controls the draft put against it. */
export interface RiskGroup {
  /** What a rename is stored against — the draft's own Risk ID where it has
   *  one, else the risk text. Stable across a prompt edit, which is what lets a
   *  name typed into the flowchart survive the draft being redrawn. */
  key: string;
  /** The file's own Risk ID, or '' when it had none. */
  riskId: string;
  /** A heading for the risk — its title, else the opening of its description. */
  title: string;
  /** The risk in full, as the draft holds it. '' when the draft has only a title. */
  statement: string;
  rows: ImportRow[];
}

/** One stage of the process — a sub-process — and the risks that sit in it. */
export interface StageGroup {
  /** The sub-process name, or 'The process' when the draft carries none. */
  name: string;
  /** True when Ira read this stage off the controls rather than off the SOP.
   *  It is printed beside the stage, because a reader has to be able to tell
   *  what the document said from what we worked out (25 Sep). */
  inferred: boolean;
  /** SOP sections the rows in this stage were read from, in order. */
  sections: string[];
  risks: RiskGroup[];
}

/** Risks are keyed by their Risk ID where the draft has one, and by their text
 *  where it does not — two rows that describe the same risk in the same words
 *  are the same risk, which is the rule the import itself uses for IDs.
 *
 *  Exported because a rename is stored against this key: whatever writes the
 *  name back into the rows has to agree with whatever drew the box, or a risk
 *  with no ID of its own would be renamed into thin air. */
export const riskKeyOf = (row: ImportRow) =>
  cell(row, 'riskId') || `~${cell(row, 'riskDescription').toLowerCase().replace(/\s+/g, ' ')}` || `~${row.key}`;

/**
 * Stage → risk → controls, keeping the draft's own order throughout.
 *
 * Order is not cosmetic here: the draft reads the SOP top to bottom, so row
 * order IS the order the process runs in. Sorting by anything else would make
 * the flowchart draw a process that does not happen in that sequence.
 */
export function groupRows(rows: ImportRow[], stageOf?: (row: ImportRow) => string): StageGroup[] {
  const stages = new Map<string, StageGroup>();
  const risks = new Map<string, RiskGroup>();

  for (const row of rows) {
    const stageName = stageOf ? stageOf(row) : cell(row, 'subProcess') || 'The process';
    let stage = stages.get(stageName);
    if (!stage) {
      stage = { name: stageName, inferred: !!stageOf, sections: [], risks: [] };
      stages.set(stageName, stage);
    }
    const section = row.sectionRef ?? cell(row, 'sopSectionRef');
    if (section && !stage.sections.includes(section)) stage.sections.push(section);

    const key = `${stageName}|${riskKeyOf(row)}`;
    let risk = risks.get(key);
    if (!risk) {
      const statement = cell(row, 'riskDescription');
      risk = {
        key: riskKeyOf(row),
        riskId: cell(row, 'riskId'),
        title: cell(row, 'riskTitle') || firstSentence(statement) || 'Unnamed risk',
        statement,
        rows: [],
      };
      risks.set(key, risk);
      stage.risks.push(risk);
    }
    risk.rows.push(row);
  }
  return [...stages.values()];
}

/**
 * Whether the draft divides the process into stages at all.
 *
 * The rule the user set (25 Sep): if the SOP names stages they are drawn, and
 * if it does not, nothing is drawn in their place. One sub-process across every
 * row is not a division of the process — it IS the process — so a heading for
 * it would be a box the SOP never asked for. Four of the seeded processes carry
 * exactly one sub-process called "General"; this is what stops it becoming a
 * stage of its own.
 *
 * The flowchart asks this before drawing, and skips its lane when the answer
 * is no.
 */
export const isStaged = (stages: StageGroup[]): boolean => stages.length > 1;

/**
 * The stage a control belongs to, read off what the control DOES.
 *
 * These are control archetypes, not one process's vocabulary: every financial
 * process has master data, transactions, reconciliations, a period end and
 * exceptions. That is what makes this a reading rather than a guess — nothing
 * here is specific to Procure to Pay or to any other process, so it cannot
 * quietly invent a stage that belongs to one SOP and not another.
 *
 * Ordered most specific first, and the order is also the order the stages come
 * out in, because it is the order the work happens in: you set up the data, you
 * transact, you process, you reconcile, you close, you chase what broke.
 *
 * Matched against the control's TITLE only. The activity text is boilerplate
 * in places — every seeded one contains the word "review" — so reading it would
 * file the whole matrix under Reporting.
 */
const STAGE_PATTERNS: { name: string; test: RegExp }[] = [
  { name: 'Access & IT', test: /\b(?:access|segregation of duties|sod|user right|privileg|password|interface|it general)\b/i },
  { name: 'Master data', test: /\bmaster (?:data|file|record)|\bstanding data\b|\bstatic data\b|\bvendor master\b|\bcustomer master\b/i },
  { name: 'Transactions', test: /\b(?:approv|authoris|authoriz|release[ds]?|sanction)/i },
  { name: 'Processing', test: /\b(?:three[- ]way|two[- ]way|match|post(?:ing|ed)?|process(?:ed|ing)?|calculat|comput)/i },
  // Measuring what is already on the books — depreciation, provisions,
  // allowances, impairment. Every process that carries a balance has this one,
  // which is why it sits on the list and "capex" does not.
  { name: 'Valuation', test: /\bcapitalis|\bcapitaliz|\bdepreciat|\bamortis|\bamortiz|\bimpair|\bvaluation\b|\bvalu(?:ed|ing)\b|\buseful li(?:fe|ves)\b|\bprovision|\ballowance\b|\bwrite[- ]?(?:off|down)\b/i },
  // Checking the book against the world, as opposed to against another book —
  // stock counts, physical verification, existence testing.
  { name: 'Verification', test: /\bphysical verification\b|\bcount(?:s|ed|ing)?\b|\binspect|\bexistence\b/i },
  { name: 'Reconciliation', test: /\breconcil/i },
  { name: 'Period-end', test: /\bperiod[- ]end\b|\bcut[- ]?off\b|\bmonth[- ]end\b|\byear[- ]end\b|\bclos(?:e|ing)\b|\baccrual/i },
  { name: 'Exceptions', test: /\bexception|\bescalat|\bdispute|\bdiscrepanc|\bfollow[- ]up\b|\baging\b|\bageing\b/i },
  { name: 'Reporting', test: /\breport|\bdisclosur|\bpresent/i },
];

/**
 * Stages read off the controls, for a draft whose SOP named none.
 *
 * Returns null rather than a partial answer. Two rules decide that:
 *
 *   every control must land somewhere — one control with no home would sit
 *   under a heading invented to hold it, which is the thing we refuse to do;
 *   and it has to produce more than one stage — filing every control under
 *   "Reconciliation" is not a division of the process, it is a relabelling.
 *
 * Either way the caller falls back to no stages at all, which is always a true
 * statement about a document that named none.
 */
export function inferStages(rows: ImportRow[], titleOf?: (row: ImportRow) => string): StageGroup[] | null {
  if (!rows.length) return null;
  const nameOf = new Map<string, string>();
  for (const row of rows) {
    // `titleOf` hands back the title the control had BEFORE the reviewer typed
    // over it. Reading the new one instead would let a rename re-file a control
    // into another stage — or, if the new words read like nothing we know,
    // collapse every stage on the chart. A rename relabels a box; it does not
    // reclassify what is in it.
    const subject = titleOf?.(row) || cell(row, 'controlTitle') || cell(row, 'objective') || cell(row, 'controlActivity');
    const hit = STAGE_PATTERNS.find(p => p.test.test(subject));
    if (!hit) return null;
    nameOf.set(row.key, hit.name);
  }
  const stages = groupRows(rows, row => nameOf.get(row.key)!);
  if (!isStaged(stages)) return null;
  // Out in the order the work happens, not the order the rows arrived.
  const rank = (name: string) => STAGE_PATTERNS.findIndex(p => p.name === name);
  return [...stages].sort((a, b) => rank(a.name) - rank(b.name));
}

/**
 * The stages to show for a draft: the SOP's own where it has them, else Ira's
 * reading of the controls, else none. Whatever draws them has to say which
 * of the two it is looking at.
 */
export function stagesFor(rows: ImportRow[], titleOf?: (row: ImportRow) => string): StageGroup[] {
  const own = groupRows(rows);
  if (isStaged(own)) return own;
  return inferStages(rows, titleOf) ?? own;
}

// ─── What gets drawn ─────────────────────────────────────────────────────────

export interface SpineControl {
  /** The ID this control will import under. */
  id: string;
  /** What a rename is stored against — see `RiskGroup.key`. Not the same as
   *  `id`: that one is generated at Review and does not exist yet beside the
   *  prompt, where these edits are made. */
  sourceId: string;
  title: string;
  isKey: boolean;
  /** The SOP section it was read from, when the draft cited one. */
  section: string;
  /** True when Ira proposed the control and the SOP never described it. */
  suggested: boolean;
}

export interface SpineRisk extends Omit<RiskGroup, 'rows'> {
  controls: SpineControl[];
}

export interface SpineStage extends Omit<StageGroup, 'risks'> {
  /** What to print. Differs from `name` once the reviewer has renamed it —
   *  `name` stays the key a rename is stored against. */
  label: string;
  risks: SpineRisk[];
}

export interface Spine {
  process: string;
  entity: string;
  /** The SOP this was read from. */
  source: string;
  /** False when the draft names no stages — then `stages` holds exactly one
   *  entry whose name means nothing and must not be printed. See `isStaged`. */
  staged: boolean;
  stages: SpineStage[];
  controlCount: number;
  riskCount: number;
  /** Draft rows the reviewer is leaving out. Stated rather than hidden — a
   *  chart silently shorter than the draft would be the worst of both. */
  omitted: number;
}


function spineControl(row: ImportRow, id: string): SpineControl {
  const title = cell(row, 'controlTitle');
  return {
    id,
    sourceId: cell(row, 'controlId') || row.key,
    title: title || firstSentence(cell(row, 'controlActivity')) || 'Untitled control',
    isKey: row.isKey,
    section: row.sectionRef ?? cell(row, 'sopSectionRef'),
    suggested: row.origin === 'suggested',
  };
}


export interface SpineOptions {
  process: string;
  entity: string;
  source: string;
  /** The ID a row will import under — the review screen's, not the file's. */
  idFor: (row: ImportRow) => string;
  /** Rows the reviewer has left out of the import. */
  omitted: number;
  /** A control's title before any rename, used only to work out which stage it
   *  belongs to. See `inferStages`. */
  classifyBy?: (row: ImportRow) => string;
}

export function buildSpine(rows: ImportRow[], opts: SpineOptions): Spine {
  const groups = stagesFor(rows, opts.classifyBy);
  const stages = groups.map<SpineStage>(stage => ({
    name: stage.name,
    label: stage.name,
    inferred: stage.inferred,
    sections: stage.sections,
    risks: stage.risks.map(risk => ({
      key: risk.key,
      riskId: risk.riskId,
      title: risk.title,
      statement: risk.statement,
      controls: risk.rows.map(row => spineControl(row, opts.idFor(row))),
    })),
  }));
  return {
    process: opts.process,
    entity: opts.entity,
    source: opts.source,
    staged: isStaged(groups),
    stages,
    controlCount: rows.length,
    // DISTINCT risks, not risks per stage (29 Sep). One risk whose controls
    // fall across four sub-processes used to be counted four times, which was
    // right while the chart drew a risk box inside every stage — and became a
    // lie the moment it started drawing each risk once (`risksAcrossStages`).
    // A header saying "4 risks" over a drawing of one is worse than no header.
    riskCount: new Set(stages.flatMap(s => s.risks.map(r => r.key))).size,
    omitted: opts.omitted,
  };
}


/**
 * Every risk in the draft, once, with all of its controls.
 *
 * The flowchart draws a tree from the SOP outwards (user, 29 Sep: "ek box jo
 * initiation point hoga with sop name written. That will have multiple risks
 * branching out and each risk will have its subsequent controls branching
 * out"), and a tree has one node per thing. A risk whose controls fall in two
 * stages is still ONE risk: drawing it twice, once per stage, would say the
 * process carries two of them.
 *
 * Stages are what decides the order and nothing else — the risks come out in
 * the order the work happens, which is the only thing the flowchart still
 * needs them for. They keep their boxes on the Spine.
 */
export function risksAcrossStages(n: Spine): SpineRisk[] {
  const byKey = new Map<string, SpineRisk>();
  for (const stage of n.stages) {
    for (const risk of stage.risks) {
      const seen = byKey.get(risk.key);
      if (!seen) { byKey.set(risk.key, { ...risk, controls: [...risk.controls] }); continue; }
      // Same control reached through two stages is still one control.
      for (const c of risk.controls) if (!seen.controls.some(x => x.sourceId === c.sourceId)) seen.controls.push(c);
    }
  }
  return [...byKey.values()];
}
