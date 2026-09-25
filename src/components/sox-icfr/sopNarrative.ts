/**
 * The SOP, told back as a process narrative.
 *
 * An SOP upload produces THREE things, not one (25 Sep): a narrative, a
 * flowchart, and the matrix. All three are read off the same draft rows, so
 * they can never disagree — edit the prompt, and all three change together.
 *
 * This file holds the spine they share:
 *
 *   `groupRows`      stage → risk → controls, in the order the draft read them.
 *                    The narrative prints it as prose; the flowchart draws it.
 *                    The aim the user stated for the flowchart — "map out the
 *                    risks, and then your corresponding controls" — is this
 *                    grouping, so both views are the same shape in the end.
 *
 *   `buildNarrative` puts sentences on that spine. Every sentence is built from
 *                    a field on the row: nothing is invented, and a row with a
 *                    field missing simply says less rather than guessing. That
 *                    is the whole rule this file follows — if the draft does
 *                    not say it, the narrative does not either.
 *
 * `narrativeText` renders the same structure as plain text, so what a reviewer
 * copies out is what they were reading.
 */
import type { ImportRow, RacmFieldKey } from './racmImport';
import type { Frequency } from './types';

const cell = (row: ImportRow, key: RacmFieldKey) => String(row.values[key] ?? '').trim();

/** Ends a fragment as a sentence without doubling punctuation the field already has. */
function sentence(text: string): string {
  const t = text.trim();
  if (!t) return '';
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/** The first sentence of a longer statement — a heading for a risk whose only
 *  text is its description. */
function firstSentence(text: string): string {
  const t = text.trim();
  if (!t) return '';
  const stop = t.search(/[.;]\s|\n/);
  const head = stop > 0 ? t.slice(0, stop) : t;
  return head.length > 90 ? `${head.slice(0, 89).trimEnd()}…` : head;
}

/** How often, said the way a narrative says it rather than the way a matrix
 *  column does. */
const FREQUENCY_PHRASE: Record<Frequency, string> = {
  Annual: 'once a year',
  Quarterly: 'each quarter',
  Monthly: 'every month',
  Weekly: 'every week',
  Daily: 'every day',
  Recurring: 'every time the transaction arises',
  'Ad-hoc': 'as occasions arise',
};

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
  /** Process owners named on this stage's rows. */
  runBy: string[];
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
      stage = { name: stageName, inferred: !!stageOf, sections: [], runBy: [], risks: [] };
      stages.set(stageName, stage);
    }
    const section = row.sectionRef ?? cell(row, 'sopSectionRef');
    if (section && !stage.sections.includes(section)) stage.sections.push(section);
    const po = cell(row, 'processOwner');
    if (po && !stage.runBy.includes(po)) stage.runBy.push(po);

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
 * Both readings ask this before drawing: the narrative skips its headings, and
 * the flowchart skips its lane.
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
 * reading of the controls, else none. The narrative prints these and the
 * flowchart will draw them, so both tell the same story about where each
 * heading came from.
 */
export function stagesFor(rows: ImportRow[], titleOf?: (row: ImportRow) => string): StageGroup[] {
  const own = groupRows(rows);
  if (isStaged(own)) return own;
  return inferStages(rows, titleOf) ?? own;
}

// ─── The narrative ───────────────────────────────────────────────────────────

export interface NarrativeControl {
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
  /** Complete sentences, in reading order. Never empty. */
  sentences: string[];
  /** What the control leaves behind, as the draft lists it. '' when it lists none. */
  evidence: string;
}

export interface NarrativeRisk extends Omit<RiskGroup, 'rows'> {
  controls: NarrativeControl[];
}

export interface NarrativeStage extends Omit<StageGroup, 'risks'> {
  /** What to print. Differs from `name` once the reviewer has renamed it —
   *  `name` stays the key a rename is stored against. */
  label: string;
  /** One sentence introducing the stage, or '' when the draft says nothing to
   *  introduce it with. */
  opening: string;
  risks: NarrativeRisk[];
}

export interface Narrative {
  process: string;
  entity: string;
  /** The SOP this was read from. */
  source: string;
  /** False when the draft names no stages — then `stages` holds exactly one
   *  entry whose name means nothing and must not be printed. See `isStaged`. */
  staged: boolean;
  /** The SOP names no stages but the controls can be grouped into some. Stays
   *  true after the reviewer ungroups, which is what gives them the way back. */
  groupable: boolean;
  stages: NarrativeStage[];
  controlCount: number;
  riskCount: number;
  /** Draft rows the reviewer is leaving out. Stated rather than hidden — a
   *  narrative silently shorter than the draft would be the worst of both. */
  omitted: number;
}

/** How a control activity spells a frequency when it mentions one at all. Used
 *  to keep the narrative from saying "every month" about a sentence that has
 *  just said "each month" — the qualifier states what the prose LEFT OUT. */
const FREQUENCY_SAID: Record<Frequency, RegExp> = {
  Annual: /\bannual|\byearly\b|\b(?:each|every|once a|per) year\b/i,
  Quarterly: /\bquarter/i,
  Monthly: /\bmonthly\b|\b(?:each|every|per|a) month\b/i,
  Weekly: /\bweekly\b|\b(?:each|every|per|a) week\b/i,
  Daily: /\bdaily\b|\b(?:each|every|per|a) day\b/i,
  Recurring: /\b(?:each|every) (?:time|transaction|occurrence|item)\b|\bper transaction\b|\bas (?:it is|they are) raised\b/i,
  'Ad-hoc': /\bad[-\s]?hoc\b|\bas (?:and when|required|needed)\b|\boccasions? aris/i,
};

/** Names are compared loosely enough that "S. Iyer" in the activity counts as
 *  the owner being named, and strictly enough that it has to be that name. */
const namesOwner = (activity: string, owner: string) =>
  !!owner && activity.toLowerCase().includes(owner.toLowerCase());

const CLASS_WORD: Record<string, string> = { Manual: 'manual', Automated: 'automated', 'IT-dependent': 'IT-dependent' };

/**
 * The one sentence a narrative adds to a control activity: what the activity
 * did NOT already say.
 *
 * The first draft of this said "S. Iyer performs it every month" under an
 * activity that opened "S. Iyer performs this control … each month", and
 * followed it with "It is designed to catch the error after it has happened" —
 * a claim invented to dress up a field. Both are gone. What is left states the
 * classification, which the prose almost never carries, and names the owner and
 * the frequency only when the prose is silent about them.
 */
function qualifier(row: ImportRow): string {
  const activity = cell(row, 'controlActivity');
  const owner = cell(row, 'owner');
  const showOwner = !!owner && !namesOwner(activity, owner);
  const showFreq = !!row.frequency && !FREQUENCY_SAID[row.frequency].test(activity);
  const freq = row.frequency ? FREQUENCY_PHRASE[row.frequency] : '';

  const words = [row.nature ? CLASS_WORD[row.nature] : '', row.type ? row.type.toLowerCase() : ''].filter(Boolean);
  const lead = words.length ? `${/^[aeiou]/i.test(words[0]!) ? 'An' : 'A'} ${words.join(' ')} control` : '';

  const bits: string[] = [];
  if (row.nature === 'Automated') {
    if (showFreq) bits.push(`applied by the system ${freq}`);
    if (showOwner) bits.push(`answered for by ${owner}`);
  } else if (showOwner && showFreq) bits.push(`performed by ${owner} ${freq}`);
  else if (showOwner) bits.push(`performed by ${owner}`);
  else if (showFreq) bits.push(`performed ${freq}`);

  if (!lead) return bits.length ? sentence(bits.join(', ').replace(/^./, c => c.toUpperCase())) : '';
  return sentence(bits.length ? `${lead}, ${bits.join(', ')}` : lead);
}

function narrativeControl(row: ImportRow, id: string): NarrativeControl {
  const title = cell(row, 'controlTitle');
  const activity = cell(row, 'controlActivity');
  // The activity IS the narrative of the control. Where the draft has none, the
  // title is all there is to say, and saying it once beats padding it out.
  const sentences = [sentence(activity) || sentence(title), qualifier(row)].filter(Boolean);
  return {
    id,
    sourceId: cell(row, 'controlId') || row.key,
    title: title || firstSentence(activity) || 'Untitled control',
    isKey: row.isKey,
    section: row.sectionRef ?? cell(row, 'sopSectionRef'),
    suggested: row.origin === 'suggested',
    sentences: sentences.length ? sentences : ['The draft carries no description for this control.'],
    evidence: cell(row, 'controlEvidence'),
  };
}

/** "Run by Priya Nair." — the only thing true of a stage as a whole. */
function stageOpening(stage: StageGroup): string {
  if (!stage.runBy.length) return '';
  const names = stage.runBy.length === 1
    ? stage.runBy[0]!
    : `${stage.runBy.slice(0, -1).join(', ')} and ${stage.runBy[stage.runBy.length - 1]}`;
  return `Run by ${names}.`;
}

export interface NarrativeOptions {
  process: string;
  entity: string;
  source: string;
  /** The ID a row will import under — the review screen's, not the file's. */
  idFor: (row: ImportRow) => string;
  /** Rows the reviewer has left out of the import. */
  omitted: number;
  /** The reviewer has turned Ira's grouping down. Only ever set when the stages
   *  were inferred — the SOP's own stages are not ours to switch off. */
  ungrouped?: boolean;
  /** What the reviewer renamed a stage to, given the name it was grouped under. */
  nameFor?: (name: string) => string;
  /** A control's title before any rename, used only to work out which stage it
   *  belongs to. See `inferStages`. */
  classifyBy?: (row: ImportRow) => string;
}

export function buildNarrative(rows: ImportRow[], opts: NarrativeOptions): Narrative {
  // Spelled out rather than calling `stagesFor`, because the narrative needs to
  // know that a grouping WAS available even when the reviewer turned it down —
  // that is the difference between an Ungroup button and a dead end.
  const own = groupRows(rows);
  const inferred = isStaged(own) ? null : inferStages(rows, opts.classifyBy);
  const groups = inferred && !opts.ungrouped ? inferred : own;
  const stages = groups.map<NarrativeStage>(stage => ({
    name: stage.name,
    label: opts.nameFor?.(stage.name) || stage.name,
    inferred: stage.inferred,
    sections: stage.sections,
    runBy: stage.runBy,
    opening: stageOpening(stage),
    risks: stage.risks.map(risk => ({
      key: risk.key,
      riskId: risk.riskId,
      title: risk.title,
      statement: risk.statement,
      controls: risk.rows.map(row => narrativeControl(row, opts.idFor(row))),
    })),
  }));
  return {
    process: opts.process,
    entity: opts.entity,
    source: opts.source,
    staged: isStaged(groups),
    groupable: !!inferred,
    stages,
    controlCount: rows.length,
    riskCount: stages.reduce((n, s) => n + s.risks.length, 0),
    omitted: opts.omitted,
  };
}

/** The same narrative as plain text, for copying into a working paper. */
export function narrativeText(n: Narrative): string {
  const out: string[] = [];
  out.push(`${n.process} — process narrative`);
  if (n.entity) out.push(n.entity);
  out.push(`Read from ${n.source}`);
  out.push('');
  n.stages.forEach((stage, i) => {
    // No stage heading where the SOP named no stages — see `isStaged`.
    if (n.staged) {
      const where = stage.inferred ? '  [grouped by Ira]' : stage.sections.length ? `  (${stage.sections.join(', ')})` : '';
      out.push(`${i + 1}. ${stage.label}${where}`);
    }
    if (stage.opening) out.push(`   ${stage.opening}`);
    stage.risks.forEach(risk => {
      out.push('');
      out.push(`   Risk${risk.riskId ? ` ${risk.riskId}` : ''}: ${risk.title}`);
      if (risk.statement && risk.statement !== risk.title) out.push(`   ${sentence(risk.statement)}`);
      risk.controls.forEach(c => {
        out.push(`     ${c.id} — ${c.title}${c.isKey ? '  [key control]' : ''}${c.section ? `  (${c.section})` : ''}`);
        c.sentences.forEach(s => out.push(`       ${s}`));
        if (c.evidence) out.push(`       Evidence: ${c.evidence}`);
        if (c.suggested) out.push('       Not described in the SOP — suggested by Ira.');
      });
    });
    out.push('');
  });
  if (n.omitted > 0) out.push(`${n.omitted} draft row${n.omitted === 1 ? '' : 's'} left out of the import, and out of this narrative.`);
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
