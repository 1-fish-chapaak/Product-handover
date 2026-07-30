// ─── SOX / ICFR — model v2 ────────────────────────────────────────────────────
//
// Test of Design (TOD) and Test of Operating Effectiveness (TOE) are INDEPENDENT
// tracks on a control — tested separately, each with its own required documents,
// steps, manual override, and conclusion. The control conclusion rolls up from
// both. Discussions are role-tagged threads anchored to a control or a track.

// Three hats, three lines: the owner remediates, the auditor tests, the reviewer
// alone closes. One human may hold owner + reviewer; the auditor stays independent.
export type Role = 'auditor' | 'risk-owner' | 'reviewer';
export const ROLE_LABEL: Record<Role, string> = { auditor: 'Auditor', 'risk-owner': 'Risk Owner', reviewer: 'Reviewer' };

export type Assertion =
  | 'Completeness' | 'Accuracy' | 'Existence / Occurrence'
  | 'Cut-off' | 'Valuation' | 'Rights & Obligations' | 'Presentation';

export type Nature = 'Manual' | 'Automated' | 'IT-dependent';
export type ControlType = 'Preventive' | 'Detective';
export type Frequency = 'Annual' | 'Quarterly' | 'Monthly' | 'Weekly' | 'Daily' | 'Recurring' | 'Ad-hoc';

export type TestResult = 'Pass' | 'Fail' | 'Not tested';
export type TestProcedure = 'Inspection' | 'Reperformance' | 'Observation' | 'Inquiry';
export type TrackConclusion = 'Effective' | 'Ineffective' | 'Not tested';
export type TrackStatus = 'Not started' | 'In progress' | 'Concluded';
export type Conclusion = 'Effective' | 'Ineffective' | 'In progress' | 'Not started';

export type Court = 'auditor' | 'risk-owner' | 'reviewer' | 'none';
export type Likelihood = 'Remote' | 'Reasonably possible' | 'Probable';
export type Severity = 'Deficiency' | 'Significant Deficiency' | 'Material Weakness';

/** A manual override of a computed/automated result, with who/why. */
export interface Override {
  result: TestResult | 'Effective' | 'Ineffective';
  by: string;
  at: string;
  rationale: string;
}

export interface EvidenceFile {
  id: string;
  name: string;
  kind: 'PDF' | 'XLSX' | 'IMG' | 'CSV';
  uploadedBy: string;
  uploadedAt: string;
}

// ─── Design track (TOD) ─────────────────────────────────────────────────────────

export type DesignDocKind =
  | 'Process narrative' | 'Flowchart' | 'Walkthrough' | 'Control description' | 'Policy / SOP'
  | 'Precision & thresholds' | 'Segregation of duties'
  // an element the auditor named themselves — its title is `name`, not the kind
  | 'Custom';
export type DocStatus = 'Received' | 'Requested' | 'Missing';

/** Why a required design element will never arrive. Three things actually happen
 *  in the field: the audit team writes the narrative and flowchart itself off the
 *  walkthrough call, the client holds the document and it was read on their screen,
 *  or there is no document at all and the design is tested off the control
 *  description. None of those is a gap, so none of them should hold the conclusion
 *  hostage — but each is a judgement, so each is recorded with a reason. */
export type DesignWaiverReason =
  | 'Prepared by the audit team'
  | 'Held by the client — inspected in situ'
  | 'Not applicable — design tested off the control description';
export const DESIGN_WAIVER_REASONS: DesignWaiverReason[] = [
  'Prepared by the audit team',
  'Held by the client — inspected in situ',
  'Not applicable — design tested off the control description',
];

/** One design element — a completeness requirement evidenced by attached files. */
export interface DesignDoc {
  id: string;
  kind: DesignDocKind;
  name: string;
  /** What the auditor is asking for — only set on a Custom element. */
  description?: string;
  status: DocStatus;
  /** Required elements gate the design conclusion; optional ones don't. Default true. */
  required?: boolean;
  /** Waived rather than received: the element is accounted for without a file, so
   *  it stops gating the conclusion. The working paper prints the reason beside
   *  the element — a waiver the paper doesn't show is an unexplained hole. */
  waiver?: { reason: DesignWaiverReason; note: string; by: string; at: string };
  files?: EvidenceFile[];
  uploadedBy?: string;
  at?: string;
}
/** The Q&A a validation workflow produced — reviewable after it runs. */
export interface ValidationQA { q: string; a: string; pass: boolean; }
/** An optional evidence table the AI returns (e.g. per-item check results). */
export interface ValidationTable { columns: string[]; rows: string[][]; }
export interface ValidationResult {
  qa: ValidationQA[];
  result?: TestResult;       // Pass / Fail the AI concluded against the uploaded file
  summary?: string;          // plain-language summary of what the AI found
  table?: ValidationTable;   // optional supporting table
  fileName?: string;         // the required file the validation ran against
  at: string;
}

/** How something was proven, weakest to strongest.
 *
 *  Asking someone is not evidence that a control worked — it is evidence that
 *  they say it did. Watching is better, inspecting the record better still, and
 *  doing it again yourself is the only one that proves the outcome. The order
 *  matters because a conclusion is only as strong as the weakest thing under it,
 *  so every piece of evidence carries its type and inquiry alone never concludes. */
export type EvidenceType = 'Inquiry' | 'Observation' | 'Inspection' | 'Reperformance';
export const EVIDENCE_TYPES: EvidenceType[] = ['Inquiry', 'Observation', 'Inspection', 'Reperformance'];
export const EVIDENCE_RANK: Record<EvidenceType, number> = { Inquiry: 0, Observation: 1, Inspection: 2, Reperformance: 3 };
/** Inquiry on its own supports nothing. Design warns; operating refuses. */
export const isInquiryOnly = (t?: EvidenceType): boolean => t === 'Inquiry';

/** What the design conclusion actually rests on. The field exists so the working
 *  paper cannot overstate itself: a design called effective off documents and a
 *  conversation reads very differently from one walked end to end, and the
 *  reviewer is entitled to know which they are looking at. */
export type DesignBasis = 'Walkthrough performed' | 'Documentation, inquiry and observation only' | 'Reperformance included';
export const DESIGN_BASES: { id: DesignBasis; hint: string }[] = [
  { id: 'Walkthrough performed', hint: 'One transaction followed from origination to the financial records.' },
  { id: 'Documentation, inquiry and observation only', hint: 'No transaction walked — the narrative and what was said and seen.' },
  { id: 'Reperformance included', hint: 'The control was performed again independently and the outcome agreed.' },
];

/** A design consideration — validated by its own workflow, with manual override. */
export interface DesignPoint {
  id: string;
  text: string;
  workflowId?: string;
  workflowName?: string;
  workflowRunRef?: string;
  validation?: ValidationResult;
  /** How this consideration was proven. Inquiry alone earns a warning. */
  evidenceType?: EvidenceType;
  result: TestResult;
  override?: Override;
}
/** The walkthrough — the design tested against ONE live transaction.
 *
 *  Design and operating effectiveness test the SAME attributes; what differs is
 *  the sample behind them. Design walks one transaction with the client and asks
 *  whether the control, as built, did what it claims. Operating asks the same
 *  questions across a frequency-driven sample. So the attributes are defined once
 *  (`OperatingTrack.steps`) and proven twice — here against `sampleRef`, there
 *  against the drawn sample. Without attributes there is no SOX test of design,
 *  only an opinion about paperwork.
 *
 *  Who sat in the walkthrough and who performed it are captured here because this
 *  is where they are known, and the working paper prints them from here. */
export interface Walkthrough {
  /** The transaction walked — drawn from the same generator the real sample uses. */
  sampleRef: string;
  date: string;
  /** Who from the audit team performed the walkthrough. */
  tester: string;
  /** Who from the client attended — the paper names them. */
  attendees: string[];
  /** Result per attribute, keyed by `OperatingStep.id`. */
  attributeResults: Record<string, TestResult>;
  notes?: string;
  evidence?: EvidenceFile[];
  startedBy: string;
  startedAt: string;
}

/** The six questions a control description has to answer before its design can be
 *  called adequate: who performs it, what the check is, when it runs, where it is
 *  evidenced, why it addresses the risk, how it is performed. A description that
 *  misses one fails design however good the evidence behind it looks. One
 *  definition, shared with the V2 test bench, so both surfaces ask the same six
 *  questions in the same words. */
export const FIVE_W_1H = [
  { k: 'Who', q: 'Performer and approver are named — and the right person signed' },
  { k: 'What', q: 'The check itself is stated, and it happened as described' },
  { k: 'When', q: 'Frequency is stated — and was met on the walkthrough sample' },
  { k: 'Where', q: 'Evidenced somewhere inspectable — system, report or document' },
  { k: 'Why', q: 'The risk it mitigates is addressed — no open or unexplained items' },
  { k: 'How', q: 'Method of performance is clear — signature, approval, tie-out' },
] as const;
export type FiveWOneH = (typeof FIVE_W_1H)[number]['k'];

/** The judgements the working paper has to state about the DESIGN itself, as
 *  against the evidence behind it. The reviewer walked their own workbook and
 *  these were the questions on it that this tool never asked: does the control
 *  description cover the six, is there a compensating control if this one fails,
 *  is the frequency appropriate to the risk, and is the type — preventive or
 *  detective — the right one. A paper that doesn't answer them leaves the reader
 *  to guess whether they were considered. */
export interface DesignJudgements {
  /** 5W+1H coverage of the control description — present or missing per question. */
  coverage?: Partial<Record<FiveWOneH, boolean>>;
  /** A control elsewhere that would catch the same failure. Empty = none identified. */
  compensatingControlId?: string;
  frequencyAppropriate?: boolean;
  typeAppropriate?: boolean;
  note?: string;
  by?: string;
  at?: string;
}

export interface DesignTrack {
  documents: DesignDoc[];
  points: DesignPoint[];
  /** The design conclusion answers two questions, not one: is the control
   *  designed to work, and is it actually in operation? A control that exists
   *  only on the narrative is not implemented however well it is designed. */
  implemented?: boolean;
  /** What the conclusion rests on — see DesignBasis. */
  basis?: DesignBasis;
  /** The design judgements above — printed in the working paper. */
  judgements?: DesignJudgements;
  /** The one-transaction walkthrough behind the design conclusion. Absent until
   *  the auditor starts it; once started, an untested attribute holds the
   *  conclusion, because a half-walked transaction proves nothing. */
  walkthrough?: Walkthrough;
  conclusion: TrackConclusion;
  override?: Override;
  testedBy: string | null;
  testedAt: string | null;
}

// ─── Operating track (TOE) ──────────────────────────────────────────────────────

export type OperatingMethod = 'Automated' | 'Manual';
/** How one attribute is evidenced — choose one per attribute. */
export type EvidenceMode = 'ai' | 'workflow' | 'attest';
/** A manual self-attestation against one attribute: an explicit Pass/Fail
 *  conclusion, supporting text, uploaded evidence, and who attested it. */
export interface Attestation {
  result?: 'Pass' | 'Fail';   // manual conclusion the attester recorded
  note: string;
  evidence: EvidenceFile[];
  by: string;
  role: Role;
  at: string;
}
/** One attribute (test step). Each attribute is evidenced independently — by its
 *  own linked workflow, or by self-attestation with text + uploaded evidence. */
export interface OperatingStep {
  id: string;
  code: string;
  description: string;
  assertion: Assertion;
  precision: string;
  procedures: TestProcedure[];
  evidenceMode?: EvidenceMode;
  /** How this attribute was proven. Operating refuses to pass on inquiry alone —
   *  "the owner confirmed it happens" is not evidence that it happened. */
  evidenceType?: EvidenceType;
  workflowId?: string;
  workflowName?: string;
  workflowRunRef?: string;
  aiValidation?: boolean;
  inputFile?: EvidenceFile;      // the required file AI validation runs against
  validation?: ValidationResult;
  attestEnabled?: boolean;
  attestation?: Attestation;
  result: TestResult;
  override?: Override;
  // Per-drawn-sample results for THIS attribute (keyed by Sample.id) — the
  // handbook grain: every attribute is tested against every sampled item.
  sampleResults?: Record<string, TestResult>;
}
/** One sampled item. `extension` marks an item drawn in the extension round that
 *  followed an exception, so the paper can show the original draw and what was
 *  added to it without holding two lists. */
export interface Sample { id: string; ref: string; result: TestResult; extension?: boolean; }
export interface Sampling {
  basis: string;
  method: 'Random' | 'Systematic' | 'Statistical' | 'Targeted' | 'Full population';
  size: number;
  /** The seed behind a random or systematic draw — what makes the selection
   *  reperformable. Without it "we picked at random" is not a procedure anyone
   *  else can walk, and the reviewer cannot land on the same items. */
  seed?: number;
  samples: Sample[];
}

/** Transaction-based counts rows; occurrence-based counts times the control ran.
 *  A monthly reconciliation is twelve occurrences however many lines it clears,
 *  and sizing it off the line count is the commonest population error there is. */
export type PopulationBasis = 'Occurrence-based' | 'Transaction-based';
/** What the population IS, settled before anything is pulled into it.
 *
 *  The answer comes out of the control's design — "what is one instance" can only
 *  be answered once you know what the control does — so this is recorded here and
 *  printed on the paper, rather than left implicit in a row count. */
export interface PopulationDefinition {
  basis: PopulationBasis;
  /** One instance, in words — "one month's completed reconciliation". */
  instance: string;
  /** How many instances the period should hold. Derived from the control's
   *  frequency for occurrence-based work, and overridable — a control that only
   *  ran nine of twelve months has a population of nine, not twelve. */
  expectedCount: number;
  /** True once the auditor typed over the derived count. */
  countOverridden?: boolean;
  /** Do rejected / failed items belong in the population? Rejections that never
   *  reach the control are out; rejections the control produced are in. */
  includeRejected: boolean;
  rejectedNote?: string;
  by: string;
  at: string;
}
/** PARKED — the three pre-lock checks, when they were three tick boxes.
 *
 *  Retired because two of the three were things the application already knew.
 *  It holds the filtered count, the control's frequency and the audit window, so
 *  asking a human to tick "count matches expected" and "date range covers the
 *  full period" was asking them to agree with arithmetic the machine had already
 *  done — a signature standing in for a calculation. Both are computed now (see
 *  `countVerdict` / `coverageVerdict` in helpers.ts) and only argued with when
 *  they fail.
 *
 *  The third, "source is the production system", is genuinely outside what the
 *  application can see, so it became `Population.provenance` — the facts of the
 *  extract rather than an attestation about it. Kept here because seeded
 *  populations still carry the field. */
export interface PopulationChecks {
  countMatches: boolean;
  dateRangeFull: boolean;
  productionSource: boolean;
}

/** Where an extract actually came from.
 *
 *  Not derivable: a file's name says nothing about the system that produced it,
 *  who ran the export or when. So it is asked for as three facts and printed on
 *  the working paper verbatim. Nobody attests that the source was production —
 *  they say which system it was, and the paper carries the claim with a name and
 *  a date against it. */
export interface PopulationProvenance {
  /** 'SAP S/4HANA — Production', 'Oracle Fusion — PROD'. */
  system: string;
  /** Whoever ran the export — usually client IT, not the auditor. */
  extractedBy: string;
  /** When they ran it. */
  extractedOn: string;
}

export interface Population {
  source: string;
  /** Instances of THIS control — what the filter produced, not what the file held. */
  count: number;
  tieOut: string;
  evidence: EvidenceFile[];
  /** The file the instances were filtered out of, and how many rows it held.
   *  Both are printed: a population that is the same size as its source file is
   *  a file that was copied rather than filtered. */
  sourceFile?: string;
  sourceCount?: number;
  /** The filter that turned those rows into this control's instances —
   *  transaction type, account, date range. Saved beside the population because
   *  a population nobody can reproduce is a number nobody can check. */
  criteria?: string;
  /** The filter window as ISO dates, kept apart from the `criteria` prose. The
   *  coverage check measures this against the audit window, and prose cannot be
   *  measured — 'full period' is a claim, '2026-01-01' is a date. */
  filterFrom?: string;
  filterTo?: string;
  /** What the count should have been, for controls whose frequency gives no
   *  answer. Asked only in that case; derived everywhere else. */
  expectedCount?: number;
  /** Why a computed check did not hold. Asked only when one fails — a population
   *  that reads short is either wrong or explainable, and either way the reason
   *  belongs on the paper. */
  countNote?: string;
  coverageNote?: string;
  provenance?: PopulationProvenance;
  /** PARKED — see PopulationChecks. Seeded populations still carry it. */
  checks?: PopulationChecks;
  locked?: { by: string; at: string };
  /** Version stamp — each round re-versions the population rather than editing
   *  the one the last round's conclusion was drawn from. */
  version?: string;
}

/** A failure on one sampled item, judged.
 *
 *  A deviation is the control not working; an anomaly is a one-off with a cause
 *  that cannot recur. The distinction changes what the sample means, so it is
 *  recorded per exception with the auditor's reason — never inferred. */
export type ExceptionKind = 'Deviation' | 'Anomaly';
export interface SampleException {
  sampleId: string;
  stepId: string;
  kind: ExceptionKind;
  reason: string;
  by: string;
  at: string;
}

/** A report standing behind the evidence — IPE gate 3.
 *
 *  `insideControl` marks the report the control itself reads. That one matters
 *  most: a perfect review performed over a wrong report is zero protection, and
 *  the control cannot be effective while the report it runs on is unproven. */
export interface EvidenceReport {
  id: string;
  name: string;
  /** What it is used for — "A2 evidence", "approval threshold". */
  usedFor: string;
  insideControl?: boolean;
  proven?: { by: string; at: string; note?: string };
}

// ─── IPE — Information Produced by the Entity ────────────────────────────────────
// A report the CLIENT generated can't be trusted just because it landed in the
// inbox. Before a single item is sampled out of it, the report itself is the thing
// under test: was it run with the right parameters, does it hold every record it
// should, and is what it says true? Reliance without that is reliance on nothing —
// so a report that isn't concluded Reliable locks the sample step behind it.
export type IpeDimension = 'Source & parameters' | 'Completeness' | 'Accuracy';
export const IPE_DIMENSIONS: IpeDimension[] = ['Source & parameters', 'Completeness', 'Accuracy'];
/** One dimension's proof — what is claimed, how it was proven, what was found. */
export interface IpeCheck {
  id: string;
  dimension: IpeDimension;
  description: string;          // the assertion being proven
  method: string;               // how it was proven — the procedure
  result: TestResult;
  /** The tester's finding — the tie-out numbers, the variance, the exception. */
  note?: string;
  evidence?: EvidenceFile[];
}
export type IpeConclusion = 'Reliable' | 'Not reliable' | 'Not tested';
export interface IpeTest {
  /** What the report is called in the source system — e.g. 'PO release log'. */
  reportName: string;
  system: string;               // 'SAP S/4HANA'
  /** Transaction code / report identifier — how anyone re-runs it. */
  reportRef: string;
  /** Exactly how it was run: company code, date range, document types. A report
   *  run over the wrong window is a wrong population, however clean it looks. */
  parameters: string;
  /** Who at the client ran it — the fact that makes it *entity*-produced. */
  generatedBy: string;
  generatedAt: string;
  recordCount: number;
  /** The number the report totals to, and what it was agreed against. */
  controlTotal: string;
  file?: EvidenceFile;
  checks: IpeCheck[];
  conclusion: IpeConclusion;
  override?: Override;
  testedBy: string | null;
  testedAt: string | null;
}

export interface OperatingTrack {
  method: OperatingMethod;        // dominant evidence mode — informational; each attribute is evidenced independently
  /** The report the population is drawn from, and its validation — IPE gate 1.
   *  Lives on the operating track because the sample it feeds does, but it is
   *  worked in step ① alongside the population it proves. */
  ipe?: IpeTest;
  /** What the population is, before anything is pulled into it. */
  definition?: PopulationDefinition;
  population?: Population;
  sampling?: Sampling;
  /** IPE gate 2 — the auditor confirmed the drawn items trace to the locked
   *  population and that the method and seed are on the paper. */
  extractionConfirmed?: { by: string; at: string };
  /** Attributes reviewed and frozen before the sample is drawn. What each item
   *  is tested against cannot keep moving once testing is under way. */
  attributesLocked?: { by: string; at: string };
  steps: OperatingStep[];
  /** Failures judged deviation or anomaly, one entry per failed item × attribute. */
  exceptions?: SampleException[];
  /** IPE gate 3 — the reports standing behind the evidence. */
  evidenceReports?: EvidenceReport[];
  conclusion: TrackConclusion;
  override?: Override;
  testedBy: string | null;
  testedAt: string | null;
}

// ─── RACM row review — the auditor's approval / remark on one matrix row ─────────
// Absent = the row is still pending the auditor's review.
export type RacmRowStatus = 'Approved' | 'Remark';
export interface RacmReview {
  status: RacmRowStatus;
  remark?: string;          // required when status is 'Remark'
  by: string;
  at: string;
}

// ─── Risk rating — how bad it is if this control fails ───────────────────────────
// Agreed with management at scoping; it can never be read off an SOP. It sets how
// deep the sample goes, because frequency on its own cannot: a quarterly control
// whose risk is Low is one occurrence a year, the same control rated High is every
// quarter. See `sampleSizeGuide`.
export type RiskRating = 'High' | 'Medium' | 'Low';
export const RISK_RATINGS: RiskRating[] = ['High', 'Medium', 'Low'];

// ─── Control classification ──────────────────────────────────────────────────────
// The RACM's own classification column. Same three words the V2 dataset uses
// (`sox-testing/v2/v2Data.ts`) — deliberately the same vocabulary, so a control
// classified in one place reads identically in the other.
export type ControlClass = 'Financial' | 'Operational' | 'Compliance';
export const CONTROL_CLASSES: ControlClass[] = ['Financial', 'Operational', 'Compliance'];

// ─── Control ─────────────────────────────────────────────────────────────────────

export interface Control {
  id: string;
  wpRef: string;            // working-paper cross-reference (the signature)
  description: string;
  process: string;
  subProcess: string;
  nature: Nature;
  type: ControlType;
  frequency: Frequency;
  isKey: boolean;
  /** WHAT THE CONTROL IS FOR — the outcome management is securing, as against the
   *  work that secures it (`controlActivity`) and the one-line label the register
   *  shows (`description`). The reviewer reads the objective first, and it was the
   *  field they asked for by name. */
  objective?: string;
  /** Financial / Operational / Compliance — the RACM's classification column. */
  clazz?: ControlClass;
  /** The RACM's Control Activity column — who does what, to which record, when,
   *  and how, spelled out in full. `description` is the one-line control
   *  statement the matrix and the register show; this is the narrative the
   *  auditor tests against, and it is what the header carries. */
  controlActivity?: string;
  precision: string;
  // Management review control — precision must be structured: the rupee threshold
  // at which the reviewer investigates, checked against performance materiality.
  isMrc?: boolean;
  mrcThreshold?: number;
  owner: string;
  riskId: string;
  riskDescription: string;
  /** WHY the risk exists — the condition underneath it. The source RACM carries
   *  this beside the risk, because a control aimed at the symptom rather than the
   *  cause is the commonest design gap there is. */
  rootCause?: string;
  /** The risk's agreed rating. Drives how deep the sample goes — see
   *  `sampleSizeGuide` — and is argued with management, not derived. */
  riskRating?: RiskRating;
  /** The programme the auditor actually walks — obtain X, check Y, verify Z.
   *  Distinct from the design considerations (what must be true) and the test
   *  attributes (what each sample proves): these are the field instructions. */
  auditSteps?: string[];
  /** Who on the audit team performed the work — the source RACM's initials column. */
  performedBy?: string;
  /** Where the evidence physically lives: the hard-copy file reference and the
   *  soft-copy path. Both survive the engagement; the working paper cites them. */
  wpRefHard?: string;
  wpRefSoft?: string;
  /** The paragraph in the issued report this row lands in, once it has a finding. */
  reportRef?: string;
  assertions: Assertion[];
  /** Days until the next scheduled test — 0 = due today, negative = overdue.
   *  Optional: when absent it is derived from the control's frequency. */
  testDueInDays?: number;
  racmReview?: RacmReview;
  design: DesignTrack;
  operating: OperatingTrack;
  /** Audit-side sign-off on THIS working paper — the preparer (auditor hat) signs
   *  once the control is concluded; the reviewer countersigns. Separate from the
   *  engagement-level opinion sign-off. */
  wpSignoff?: { preparer?: SignoffEntry; reviewer?: SignoffEntry };
  /** The reviewer sent the concluded paper back instead of countersigning —
   *  conclusions cleared, note recorded; cleared when the auditor re-concludes. */
  reviewReturn?: { reason: string; by: string; at: string };
}

// ─── Discussions (role-tagged threads) ──────────────────────────────────────────

export type DiscussionAnchor = 'control' | 'design' | 'operating';
export interface DiscussionComment {
  id: string;
  by: string;
  role: Role;
  at: string;
  text: string;
}
export interface Discussion {
  id: string;
  controlId: string;
  anchor: DiscussionAnchor;
  resolved: boolean;
  comments: DiscussionComment[];
}

// ─── Review notes — the reviewer's formal channel on a working paper ─────────────
// Lifecycle: the reviewer raises → the auditor resolves with a response → the
// reviewer verifies & closes (or reopens). Role gates keep it four-eyes: the
// raiser never resolves their own note, the resolver never verifies. A note that
// isn't Closed blocks the paper's countersign. Discussions stay the informal channel.
export type ReviewNoteStatus = 'Open' | 'Resolved' | 'Closed';
export interface ReviewNote {
  id: string;
  controlId: string;
  text: string;                                        // what the reviewer challenged
  raisedBy: string;
  raisedAt: string;
  status: ReviewNoteStatus;
  resolution?: { text: string; by: string; at: string };  // the auditor's response
  verified?: { by: string; at: string };                   // the reviewer's close
}

// ─── Handoffs, deficiencies, scope, engagement ───────────────────────────────────

export type TaskType = 'pbc' | 'query' | 'remediation';
export type TaskStatus = 'open' | 'cleared';
export interface HandoffTask {
  id: string;
  type: TaskType;
  controlId: string;
  title: string;
  detail: string;
  assignee: string;
  assigneeRole: Role;
  raisedBy: string;
  dueLabel: string;
  overdue: boolean;
  status: TaskStatus;
}

// ─── Gap taxonomy — the source RACM's own vocabulary ─────────────────────────────
// A finding is named by where it was found and what kind of thing broke. The
// walkthrough finds DESIGN gaps: the control as built can't do the job (MDG), or
// the system doesn't enforce what the narrative claims (ITDG). Sampling finds
// TESTING gaps: the control is designed fine but didn't operate (TG). The
// distinction drives the fix — a design gap needs a redesign, a testing gap needs
// discipline — so it is recorded on the exception, not inferred later.
export type GapType = 'MDG' | 'ITDG' | 'TG';
export const GAP_LABEL: Record<GapType, string> = {
  MDG: 'Manual design gap',
  ITDG: 'IT design gap',
  TG: 'Testing gap',
};
export const GAP_HINT: Record<GapType, string> = {
  MDG: 'Found in the walkthrough — the manual control as designed cannot prevent or detect the risk.',
  ITDG: 'Found in the walkthrough — the system does not enforce what the control claims.',
  TG: 'Found in sampling — the control is designed adequately but did not operate as designed.',
};

/** What the gap is worth in rupees, split the way the source RACM splits it.
 *  Quantifying is what turns a finding into something a CFO acts on. */
export interface Exposure {
  /** Recoverable from a counterparty — raise a debit note and get it back. */
  recovery: number;
  /** Cash sitting trapped that the fix releases — not a loss, a timing gain. */
  workingCapital: number;
  /** Gone. Value that left the business and isn't coming back. */
  leakage: number;
  /** How the numbers were arrived at — the arithmetic behind the claim. */
  basis?: string;
}
export const EXPOSURE_LABEL: Record<Exclude<keyof Exposure, 'basis'>, string> = {
  recovery: 'Recovery / debit note',
  workingCapital: 'Working-capital unblock',
  leakage: 'Leakage',
};
export const exposureTotal = (e?: Exposure): number =>
  e ? e.recovery + e.workingCapital + e.leakage : 0;

export interface Deficiency {
  id: string;
  controlId: string;
  track: 'design' | 'operating';
  /** MDG / ITDG / TG. Defaults from the track and the control's nature when the
   *  exception is raised; the auditor can re-type it on the exception card. */
  gapType?: GapType;
  /** What the gap is worth — priced by the auditor, argued by the owner. */
  exposure?: Exposure;
  /** Where this lands in the report — the source RACM's report reference number. */
  reportRef?: string;
  description: string;
  rootCause: string;
  likelihood: Likelihood;
  magnitude: number;
  mwIndicators: string[];
  compensatingControlId?: string;
  aggregationGroup?: string;
  // The owner's commitment: what will fix the ROOT CAUSE, who does it, by when —
  // and the evidence they attach before declaring it done (submit for retest).
  remediation: { action: string; date: string | null; owner: string; status: 'Open' | 'In progress' | 'Done'; evidence?: EvidenceFile[] };
  // exception lifecycle
  status: ExceptionStatus;
  retest?: { result: 'Pass' | 'Fail'; at: string; by: string };
  signoff?: { by: string; at: string };
  // Prudent-official judgment: severity can be argued UP (never down) with a
  // recorded rationale — the handbook's judgment floor over the pure math.
  prudentOverride?: { to: Severity; rationale: string; by: string; at: string };
}
// A passed retest parks at 'Awaiting reviewer' — only the reviewer closes (four-eyes).
export type ExceptionStatus = 'Identified' | 'Remediation' | 'Retest' | 'Awaiting reviewer' | 'Closed';

export interface SignificantAccount {
  id: string; name: string; balance: number; inScope: boolean; assertions: Assertion[];
  // scoping front door: which business process covers this account, and the
  // "what could go wrong" statements driving its relevant assertions
  process?: string;
  wcgw?: string[];
}

/** The engagement-level "ground rules" that drive how every exception is evaluated and routed. */
export const MW_INDICATOR_CATALOGUE = [
  'Restatement of previously issued financial statements',
  'Material misstatement identified by audit, not the control',
  'Fraud of any magnitude by senior management',
  'Ineffective control environment / oversight',
  'Ineffective period-end financial reporting process',
] as const;
// ─── Materiality basis — the benchmark worksheet behind the number ───────────────
// Set in the engagement drawer, locked at go-live: the benchmark, its annualized
// amount (from the uploaded one-month GL), the chosen %, and how performance
// materiality allocates across the significant account groups.
export interface BenchmarkAmounts { assets: number; revenue: number; pbt: number; cash: number; equity: number; }
export type BenchmarkKey = keyof BenchmarkAmounts;
export interface MaterialityAllocation { group: string; balance: number; sharePct: number; allocated: number; }
export interface MaterialityBasis {
  benchmark: BenchmarkKey;
  amounts: BenchmarkAmounts;     // annualized (P&L ×12) / point-in-time (balance sheet)
  pct: number;                   // chosen % of the benchmark
  pmPct: number;                 // performance materiality as % of overall (50–75)
  ctPct: number;                 // clearly-trivial as % of overall (usually 5)
  source: string;                // e.g. 'GL Apr 2026 (AG01) · P&L annualized ×12'
  allocation: MaterialityAllocation[];
  lockedAt?: string;             // set at go-live — materiality can't change after
}

/** What the tool detected from the uploaded RACM / GL when the engagement was created. */
export interface EntityDetection { name: string; companyCode: string; source: string; }

export interface MaterialityRules {
  clearlyTrivial: number;        // de-minimis threshold (₹) — below this, an exception is clearly trivial
  sdBandPct: number;             // significant-deficiency lower band, as % of overall materiality (e.g. 20)
  aggregate: boolean;            // aggregate individually-minor deficiencies by commonality
  autoRoute: boolean;            // auto-route an exception to the owner/reviewer by computed severity
  mwIndicators: string[];        // MW indicators in force for this engagement (from the catalogue)
}

// ─── Execution history (shared audit trail) ──────────────────────────────────────
// Every test-of-design / test-of-operating action either persona takes is logged here,
// so the auditor and the risk owner each see what the other ran on a control, and when.
export type ExecKind =
  | 'validate' | 'test-all' | 'pull-run' | 'attest' | 'conclude'
  | 'override' | 'request-docs' | 'receive-doc' | 'waive-doc' | 'walkthrough' | 'ipe' | 'population' | 'sample' | 'reopen' | 'wp-signoff' | 'review-return' | 'exception';
export interface ExecutionEvent {
  id: string;
  controlId: string;
  track: 'design' | 'operating';
  kind: ExecKind;
  verb: string;                               // active-voice phrase, e.g. 'validated', 'concluded effective'
  target?: string;                            // attribute code / consideration / document the action touched
  result?: TestResult | TrackConclusion;      // outcome, when the action produced one
  by: string;                                 // actor display name
  role: Role;                                 // actor role — drives the trail's glyph + tint
  at: string;
}

// ─── Runs (execution registry — the Runs tab) ────────────────────────────────────
// One record per run: a bulk test across controls, a single control's test-all, a
// workflow run pulled for an attribute, or an AI validation against a file. The
// per-control `executions` trail above stays the fine-grained audit log.
export type RunKind = 'bulk-test' | 'control-test' | 'workflow-run' | 'ai-validation';
export interface RunControlOutcome {
  controlId: string;
  wpRef: string;
  description: string;
  outcome: 'Effective' | 'Ineffective';
  checks: number;
}
export interface RunRecord {
  id: string;
  kind: RunKind;
  label: string;            // headline, e.g. 'Bulk test — 12 controls'
  detail?: string;          // supporting line — datasets, attribute code, run ref
  controls: RunControlOutcome[];
  datasets?: string[];      // unique datasets the run executed against
  by: string;
  role: Role;
  at: string;
}

// ─── Audits (the Audit logs tab) ─────────────────────────────────────────────
// One record per audit created from the "New audit" wizard: a period, what it
// covers (entities OR RACMs — the wizard makes you pick a side), the TB / GL
// files attached, and the materiality rule in force. Distinct from RunRecord
// above: a run is one execution, an audit is the scoped piece of work.
export type AuditScopeKind = 'entity' | 'racm';

/**
 * Which round of the cycle an audit is.
 *
 * SOX is not tested once a year — interim testing covers the first part of the
 * period, roll-forward extends that evidence towards the year end, and the
 * year-end round tests what is left as of the balance-sheet date. The engagement
 * portfolio groups by fiscal year and then by this, and the coverage timeline
 * places each audit from its window, so a gap in the period is visible.
 */
export type AuditRound = 'interim' | 'rollforward' | 'yearend';

/** The audit tabs a read-only archive can be asked to render. A subset of the
 *  store's SoxTab, redeclared here because the store imports this module and not
 *  the other way round. */
export type SoxTabLike = 'overview' | 'controls' | 'deficiencies' | 'config';
export const AUDIT_ROUNDS: { id: AuditRound; label: string; hint: string }[] = [
  { id: 'interim', label: 'Interim', hint: 'Tests the first part of the period, well before the year end.' },
  { id: 'rollforward', label: 'Roll-forward', hint: 'Extends interim evidence towards the year end.' },
  { id: 'yearend', label: 'Year-end', hint: 'Tests as of the balance-sheet date.' },
];

/**
 * What an audit concluded, frozen when the next audit starts.
 *
 * A control holds ONE live design / operating paper, so a new cycle has to reset
 * it. Before the rework that reset simply deleted the previous results — which
 * made the engagement portfolio impossible: no prior-year deficiencies to carry
 * forward, no way to say what a control concluded last year, and last year's ICFR
 * opinion gone. The outgoing cycle is now snapshotted onto the audit it belonged
 * to instead (store.tsx createAudit), and the engagement Overview reads these.
 *
 * Severity is stored ON the snapshot: assessSeverity() needs the live engagement
 * to apply the compensating-control cap, and that engagement no longer exists in
 * the state the deficiency was raised in.
 */
export interface AuditArchive {
  conclusions: {
    controlId: string;
    wpRef: string;
    process: string;
    description: string;
    design: TrackConclusion;
    operating: TrackConclusion;
    conclusion: Conclusion;
  }[];
  deficiencies: (Deficiency & { severity: Severity })[];
  concludedAt: string;
}

export interface AuditRecord {
  id: string;
  /** Cycle label the period step produced, e.g. 'FY 2026-27' or 'CY 2027'. */
  period: string;
  /** 'fy' | 'cy' | 'quarter' | 'custom' — kept so the review step and the list
   *  can re-state the span. Quarter and custom are one-off checks rather than a
   *  named annual cycle: they skip the round question (store.tsx / auditPortfolio.ts
   *  treat 'round' as 'yearend' for these two, and the engagement-level portfolio
   *  rollups only group fy/cy audits into a fiscal year). */
  yearBasis: 'fy' | 'cy' | 'quarter' | 'custom';
  /** The year the cycle ENDS on, as a number — 'FY 2026-27' ⇒ 2027. Stored rather
   *  than regex-parsed out of `period` at every call site, which is what the
   *  portfolio's grouping used to have to do. */
  fiscalYear: number;
  periodSpan: string;               // 'Apr 2026 – Mar 2027'
  /** Which round of the cycle this is. */
  round: AuditRound;
  /** The window the round actually covers, as ISO dates. `periodSpan` above is
   *  the prose label and can't be measured; the coverage timeline needs real
   *  months to place a bar and to spot an uncovered stretch. */
  windowFrom: string;               // '2026-01-01'
  windowTo: string;                 // '2026-06-30'
  scopeKind: AuditScopeKind;
  /** Names of the entities or RACM processes selected — display-ready. */
  scopeNames: string[];
  /** Entity ids behind those names (empty when scoped by RACM). Kept alongside
   *  the names because filtering the workspace needs ids, not display text. */
  scopeIds: string[];
  /** The exact controls the audit tests, when they were picked one by one on the
   *  RACM side of the scope step (including "key controls only"). Absent or
   *  empty means the whole of every picked RACM — an audit scoped by entity
   *  never sets it, because there the processes decide. */
  controlIds?: string[];
  /** Simulated TB / GL uploads; empty when the step was skipped. */
  files: { name: string; kind: 'tb' | 'gl' }[];
  /** The rule as set on the materiality step. Shape is inlined rather than
   *  imported from soxTestingData — this module deliberately has no imports,
   *  and the audit freezes its own copy anyway, so later edits to the
   *  programme's rules don't rewrite history. */
  materiality: { basisLabel: string; benchmark: number; pct: number };
  /** ₹ Cr threshold the rule computes, frozen at creation. */
  overall: number;
  /** This audit's own conclusion. Sign-off is per AUDIT, not per engagement —
   *  the testing happens inside an audit, so that is where the preparer signs and
   *  the reviewer countersigns. There is no engagement-level ICFR sign-off. */
  signoff?: EngagementSignoff;
  /** The audit this one was rolled forward from, so the carry-forward chain can
   *  be read back. Roll-forward used to leave no trace at all. */
  rolledFromId?: string;
  /** What this audit concluded, frozen when the next one started. Absent while it
   *  is the live cycle — its results are then on the controls themselves. */
  archive?: AuditArchive;
  by: string;
  role: Role;
  at: string;
}

// ─── Ground-rules change log — materiality is set before testing; a mid-engagement
// change is warned, previewed (which exceptions re-grade), and recorded here. ──────
export interface RulesChangeEntry {
  id: string;
  changes: { field: string; from: string; to: string }[];
  regraded: { defId: string; from: Severity; to: Severity }[];
  reason: string;
  by: string;
  at: string;
}

// ─── Engagement sign-off — preparer signs, reviewer countersigns, engagement locks ─
export interface SignoffEntry { by: string; at: string }
// icfrConclusion is stamped at each signature from live state: open MW ⇒ 'Not effective'.
export interface EngagementSignoff { preparer?: SignoffEntry; reviewer?: SignoffEntry; icfrConclusion?: 'Effective' | 'Not effective' }

export interface IcfrEngagement {
  id: string; code: string; name: string; entity: string; framework: string;
  // No Interim / Year-end round here — the period comes from the newest record
  // in `audits` below, set when an audit is created on the Audit logs tab.
  periodStart: string; periodEnd: string;
  materiality: number; performanceMateriality: number; preparer: string; reviewer: string;
  live?: boolean;
  wentLiveAt?: string;
  entityDetected?: EntityDetection;
  materialityBasis?: MaterialityBasis;
  rules: MaterialityRules;
  accounts: SignificantAccount[];
  controls: Control[];
  deficiencies: Deficiency[];
  tasks: HandoffTask[];
  discussions: Discussion[];
  reviewNotes: ReviewNote[];
  executions: ExecutionEvent[];
  runs: RunRecord[];
  audits: AuditRecord[];
  signoff: EngagementSignoff;
  rulesLog: RulesChangeEntry[];
}

export const DESIGN_DOC_KINDS: DesignDocKind[] = ['Process narrative', 'Flowchart', 'Walkthrough', 'Control description', 'Policy / SOP', 'Precision & thresholds', 'Segregation of duties'];

/** Where a fresh exception starts on the gap taxonomy. Sampling finds testing
 *  gaps; the walkthrough finds design gaps — IT-flavoured when the control leans
 *  on the system to work, manual when a person is the control. */
export const defaultGapType = (track: 'design' | 'operating', nature: Nature): GapType =>
  (track === 'operating' ? 'TG' : nature === 'Manual' ? 'MDG' : 'ITDG');

/** The three checks every entity-produced report answers before it is relied on.
 *  Seeded when the report is registered so the auditor tests, never authors. */
export const ipeChecklist = (reportLabel: string): Omit<IpeCheck, 'id'>[] => [
  {
    dimension: 'Source & parameters',
    description: `${reportLabel} was run from the live system over the audit period, with the scoping filters the test assumes.`,
    method: 'Inspect the parameter screen capture — system, company code, date range and document types — and agree each to the test scope.',
    result: 'Not tested',
  },
  {
    dimension: 'Completeness',
    description: 'Every record that should be in the report is in it — nothing was filtered, truncated or paged away.',
    method: 'Agree the report record count and control total to the system total or the GL control account; re-run over a narrower window and confirm the subset ties.',
    result: 'Not tested',
  },
  {
    dimension: 'Accuracy',
    description: 'What the report says about each record is true.',
    method: 'Vouch a spot-check of records back to source documents, field by field, and re-perform any calculated column.',
    result: 'Not tested',
  },
];

/** What the three checks add up to. A single failure sinks the report — an
 *  incomplete population is the wrong population, not a slightly worse one. */
export const ipeSuggestion = (t: IpeTest): IpeConclusion =>
  t.checks.some(c => c.result === 'Fail') ? 'Not reliable'
    : t.checks.length > 0 && t.checks.every(c => c.result === 'Pass') ? 'Reliable'
    : 'Not tested';

/** The gate the sample step sits behind: no reliable report, nothing to sample. */
export const ipeReliable = (o: OperatingTrack): boolean => o.ipe?.conclusion === 'Reliable';
