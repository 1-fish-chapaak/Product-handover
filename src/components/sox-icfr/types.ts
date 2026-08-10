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

/** What the severity engine actually answers. `Severity` above is the reportable
 *  grade — the three the auditor's report names. Clearly Trivial is the fourth
 *  outcome: logged, never evaluated further, and it stops the ladder dead. The
 *  conclusion shown on an exception is always this, never a hand-set field. */
export type ExceptionGrade = 'Clearly Trivial' | Severity;
export const EXCEPTION_GRADES: ExceptionGrade[] = ['Clearly Trivial', 'Deficiency', 'Significant Deficiency', 'Material Weakness'];
export const GRADE_RANK: Record<ExceptionGrade, number> = {
  'Clearly Trivial': -1, Deficiency: 0, 'Significant Deficiency': 1, 'Material Weakness': 2,
};

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

/** What the auditor did on a check with their own hands.
 *
 *  The three kinds are not decoration — they are what the design conclusion's
 *  stated basis is derived from, so nobody types a basis they did not earn. */
export type AuditorProofKind = 'Walkthrough note' | 'Configuration extract' | 'Reperformance result';
export const AUDITOR_PROOF_KINDS: AuditorProofKind[] = ['Walkthrough note', 'Configuration extract', 'Reperformance result'];
export interface AuditorProof {
  kind: AuditorProofKind;
  file: EvidenceFile;
  /** What it showed — the finding, not the filename. */
  note?: string;
}

/** A design consideration — validated by its own workflow, with manual override. */
export interface DesignPoint {
  id: string;
  text: string;
  /** THE ATTRIBUTE THIS CHECK IS ABOUT — an `OperatingStep.id`.
   *
   *  Set on an attribute-level check (dev call, Aug 2026: "हर एट्रिब्यूट का अपना
   *  चेक होगा"), absent on a control-level one. Both live in the same
   *  `design.points` array on purpose: a check is a check, and everything that
   *  already acts on one — pass/fail, evidence links, the auditor's own proof,
   *  validation, override, and the rule that sinks TOD when any check fails —
   *  keeps working without knowing which kind it is holding.
   *
   *  The two kinds ask different questions and both are worth asking. Control
   *  level: does this control address the risk at all, and at what precision.
   *  Attribute level: is THIS thing the control has to do actually designed to
   *  happen. Dropping either would leave a design test that cannot fail for a
   *  reason the other one covers. */
  stepId?: string;
  workflowId?: string;
  workflowName?: string;
  workflowRunRef?: string;
  validation?: ValidationResult;
  /** How this consideration was proven. Inquiry alone earns a warning. */
  evidenceType?: EvidenceType;
  /** Which design ELEMENTS on this control evidence this check — DesignDoc ids.
   *
   *  A reference, never a copy. The client's file is uploaded once against the
   *  element it belongs to and pointed at from here; the same document must not
   *  enter the audit twice for one control, and certainly not once per check.
   *  So there is deliberately NO client-evidence slot on a check. */
  evidencedBy?: string[];
  /** The auditor's OWN proof — a walkthrough note, a configuration extract they
   *  pulled themselves, a reperformance result.
   *
   *  One slot, because this is the only thing with no home at element level:
   *  elements are what the client supplied. A check carrying nothing here was
   *  taken on the documents; a check carrying something is one the auditor did
   *  work on, and that difference is what designBasis reads. */
  auditorProof?: AuditorProof;
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
  /** Why the track concluded the way it did — recorded on EVERY conclusion, not
   *  only on an override. A working paper whose conclusion carries no words is a
   *  hole; see `concludeRationale`, which drafts it from the evidence so agreeing
   *  stays one click. `override.rationale` is the narrower thing: why the auditor
   *  went against what the evidence pointed at. */
  rationale?: string;
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
export interface Sample {
  id: string; ref: string; result: TestResult; extension?: boolean;
  /** Which source file this item was drawn out of — see PopulationSource. Absent
   *  on a control standing on a single file, which is every control seeded before
   *  a control could stand on several. */
  sourceId?: string;
}
/** The control's sample — every item drawn, across every source file it stands
 *  on. `size` and `samples` are the totals; which file each item came out of is
 *  on the item (`Sample.sourceId`), and how each file's own draw was made is on
 *  the file (`PopulationSource.draw`). TOE reads this one list and never has to
 *  ask how many files fed it. */
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

/** Where a file came from. Two answers, both meaningful: an export pulled out of
 *  the system of record is as complete as the system is, while a file the client
 *  assembled is only as complete as whoever assembled it chose to make it — and
 *  sampling can never reveal a row that was left out.
 *
 *  There is deliberately no third "unknown": a file nobody can place cannot be
 *  used as a population source at all, so it is a question with an answer rather
 *  than a state to sit in. */
export type FileOrigin = 'System export' | 'Client-prepared';

/** One file the audit holds, and everything known about it.
 *
 *  Provenance lives HERE and nowhere else. It is a property of the FILE, settled
 *  the moment the file enters the audit — so a general ledger forty controls
 *  extract from is answered once, at upload, not forty times at forty
 *  extractions. Every population that draws off it inherits the answer, and a
 *  later round inherits it again.
 */
export interface AuditFileRecord {
  name: string;
  /** 'Trial balance' | 'General ledger' | 'RACM / SOP' | free text for a file a
   *  control brought in itself. */
  kind: string;
  rows: number;
  /** Where it entered from — the audit period, engagement scoping, or the
   *  control that uploaded it. */
  from: string;
  uploadedBy: string;
  uploadedAt: string;
  /** Answered at upload. Absent only on a file that entered before anyone was
   *  asked — and a file with no answer cannot be used as a population source. */
  origin?: FileOrigin;
  /** The platform pulled this data itself: provenance is known from the fetch,
   *  so the question is never put. */
  systemFetched?: boolean;
  /** The system of record it was pulled from — 'SAP S/4HANA — Production'. Set
   *  only alongside `systemFetched`; it is what makes the fetch answerable on
   *  the working paper without anybody typing it. */
  system?: string;
  /** Who answered, and when. Re-stamped when the answer is changed on the file
   *  record — the only place it can be changed. */
  originBy?: string;
  originAt?: string;
}

/** One source file a control's population stands on.
 *
 *  A control rarely stands on one file. A three-way match reads the purchase
 *  order, the goods receipt and the invoice; a quarterly review is four
 *  extracts, one per quarter. Each file is proven on its own — its own four IPE
 *  dimensions — and sampled on its own, because a file nobody proved is a file
 *  nobody may sample from, and proving one file says nothing about the next.
 *
 *  What is NOT here, on purpose:
 *  - provenance. It belongs to the file record and is inherited, exactly as it
 *    was when a control had one source. `file` is the join back to it.
 *  - the four checks. They live in `IpeTest.checks`, tagged with `sourceId`, so
 *    the single centralised Reliable / Not reliable verdict still reads one flat
 *    list and one failure anywhere still sinks the report.
 *  - the drawn items. They live in `Sampling.samples`, tagged the same way, so
 *    TOE tests one list of items and does not have to know how many files they
 *    came out of. */
/** What a source file IS to the control.
 *
 *  Not every file a control reads is a population. Testing for duplicate vendor
 *  invoices reads a journal table AND a vendor master, but the invoices are the
 *  thing being tested and the vendor master is only joined onto them — "वेंडर
 *  मास्टर इज ए असिस्टिंग टेबल… वेंडर मास्टर का पापुलेशन ड्रा नहीं होगा, सिर्फ
 *  BKPF का ही होगा". An assisting file is still PROVEN — a join onto an
 *  unreliable table produces an unreliable answer — but it is never sampled and
 *  its rows are never counted as instances of the control. */
export type SourceRole = 'population' | 'assisting';

export interface PopulationSource {
  id: string;
  /** The file record's name. */
  file: string;
  /** What the file held, and what this control's filter left of it. */
  rows: number;
  count: number;
  criteria?: string;
  /** Absent means population — every file drawn before the distinction existed
   *  was one. The FIRST file is a population by default and everything added
   *  after it is assisting until somebody says otherwise: the common reason to
   *  add a second file is to join something onto the first, and a file that is
   *  silently sampled is a sample nobody asked for. */
  role?: SourceRole;
  /** The draw made off THIS file — what was asked for, how many it came to, and
   *  the seed that makes it reperformable. The items themselves are in
   *  `Sampling.samples`. Absent until this file is sampled; a control can have
   *  three files sampled and a fourth still waiting.
   *
   *  `prompt` is what the auditor actually asked for, in their own words. A
   *  number could not carry it: the selection unit is not always a quantity
   *  (dev call, Aug 2026 — "कभी क्वांटिटी हो रहा है X, तो कभी हो रहा है टाइम"),
   *  and duplicate-invoice work over a journal table is not a thing 25 rows can
   *  find at all. It is stored because with a prompt the prompt IS the method,
   *  and a draw nobody can read back is not a procedure. */
  draw?: { size: number; method: Sampling['method']; seed: number; prompt?: string };
  /** The tick on this file's accordion — "done with this one, on to the next".
   *
   *  Deliberately NOT a lock (dev call, Aug 2026: "लॉक ऐसे नहीं, बस अप्रूव मतलब
   *  टिक लग गया" — the section ticks on a tax return, not a signature). Two of
   *  them because the file is worked twice, once to prove it and once to sample
   *  it, and a control opened tomorrow has to be able to say which halves of
   *  which files are still owed: "चार का तुमने कर दिया था, दो बच रहा था".
   *
   *  Reversible on purpose. Re-drawing a file clears its sample tick, and
   *  answering one of its checks again clears its proof tick — a tick that
   *  survived the work it stood for would be a tick that means nothing. */
  approvedIpe?: { by: string; at: string };
  approvedSample?: { by: string; at: string };
}

export interface Population {
  source: string;
  /** The files this population was built out of, in the order they were added.
   *  Absent on a population drawn before a control could stand on more than one
   *  — read it through `populationSources`, which presents the single-file case
   *  as a one-entry list so nothing downstream has to branch. */
  sources?: PopulationSource[];
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
  /** The filter's own dimensions, held apart from the `criteria` prose. An
   *  over-extraction is diagnosed by breaking the surplus down along the thing
   *  that was filtered on, and prose cannot be grouped by. */
  filterType?: string;
  filterAccount?: string;
  /* PARKED (dev call, Aug 2026) — `expectedCount?: number` sat here: what the
     auditor said the count should be, typed before the extract ran so the two
     could be compared afterwards. The call cut the field on the grounds that the
     reference number is already visible on the source. NOTE this is NOT
     PopulationDefinition.expectedCount, which is a different field on a
     different type and is still live. */
  /** NOTE — there is no provenance field here on purpose. Where the data came
   *  from belongs to the FILE (see AuditFileRecord), is answered once when the
   *  file enters the audit, and is inherited by every population drawn off it.
   *  A copy taken at extraction time would go stale the moment the file record
   *  was corrected, and would ask forty controls the same question. */
  /** The count is context the application assembles and a human agrees with —
   *  the per-month shape and the prior round are what make "this looks right" a
   *  judgement rather than a shrug. */
  countConfirmed?: { by: string; at: string };
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
export type IpeDimension = 'Source & parameters' | 'Period coverage' | 'Completeness' | 'Accuracy';
export const IPE_DIMENSIONS: IpeDimension[] = ['Source & parameters', 'Period coverage', 'Completeness', 'Accuracy'];
/** One dimension's proof — what is claimed, how it was proven, what was found. */
export interface IpeCheck {
  id: string;
  /** Which source file this dimension was proven on — see PopulationSource. A
   *  control standing on three files has three sets of four checks, and the
   *  verdict they roll up to is still one (dev call, Aug 2026: "सेंट्रलाइज्ड कर
   *  दो ना"). Absent on a control standing on a single file. */
  sourceId?: string;
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
  /** Why the track concluded the way it did — see DesignTrack.rationale. */
  rationale?: string;
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
  /** THE CONTROL NUMBER THE CLIENT KNOWS — set only when `id` had to be made
   *  unique because the same control runs at more than one company. The register,
   *  the control page and the working paper all print `code ?? id`, so two rows
   *  of the same control read with the same number and are told apart by their
   *  entity. See `entity`. */
  code?: string;
  /** THE COMPANY THIS ROW IS TESTED AT.
   *
   *  A group audit tests the same control separately at every entity in its
   *  scope: same number, same wording, entirely separate lives. Altura's
   *  Treasury controls run at four companies — one may be concluded effective
   *  while another has not started, and a failure at one says nothing about the
   *  others. So an entity's copy is its OWN row with its own design and
   *  operating tracks, its own sample, its own conclusion and its own findings.
   *
   *  Absent on engagements that were never scoped by entity. */
  entity?: string;
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
  /** THE CONTROL OWNER — accountable that the control operates. The name the
   *  register shows and the one a failure lands on. */
  owner: string;
  /** THE PROCESS OWNER — runs the area day to day, and is therefore who an
   *  evidence request actually reaches; the control owner is only copied.
   *
   *  Two people, not one, because they are usually not the same person: the CFO
   *  owns the control, the finance manager is the one who can produce the file.
   *  A request addressed to the accountable name alone is a request addressed to
   *  someone who has to forward it. Recorded per RACM in the scoping wizard's
   *  People step; absent on controls created before that step existed, which is
   *  why it is optional and every read falls back to `owner`. */
  processOwner?: string;
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
  /** The auditor could not test at all. Deliberately NOT an exception: nothing
   *  has been shown to have failed, so exposure and likelihood do not apply and
   *  a severity would be a fabrication. See `UnableToTest`. */
  unableToTest?: UnableToTest;
}

/** "Unable to test — waiting on owner". A status on the CONTROL, not a second
 *  exception lifecycle: the auditor records why testing is blocked and what is
 *  needed, and it sits in the owner's court like any other document request.
 *
 *  If it is still open at period end it converts to an ordinary exception — the
 *  control could not be evidenced as operating, so it concludes ineffective and
 *  runs the normal severity ladder. The reason carries across so the working
 *  paper shows why it was never evidenced rather than merely that it failed. */
export interface UnableToTest {
  track: 'design' | 'operating';
  /** Why testing could not proceed — the blocker, in the auditor's words. */
  reason: string;
  /** What the owner has to produce for testing to resume. */
  needed: string;
  raisedBy: string;
  raisedAt: string;
  resolvedBy?: string;
  resolvedAt?: string;
  /** Set when period end forced it into an exception — the id it became. */
  convertedTo?: string;
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
  /** Which step on the control page answers this task. A row that names a
   *  specific thing should land on that thing rather than on a page the
   *  reader then has to search — the same reasoning `focusDefId` follows for
   *  deficiencies. Absent means the top of the page, which is right for a
   *  task that is about the control as a whole. */
  focus?: 'population';
  overdue: boolean;
  status: TaskStatus;
}

// ─── Gap nature — DERIVED, never asked ───────────────────────────────────────────
// The old Gap type field asked the auditor to classify a finding as a manual
// design gap, an IT design gap or a testing gap. It is gone: manual vs IT is
// already settled by the control's nature on the RACM, and design vs operating is
// already settled by which track failed. Asking again could only produce a
// contradiction. This derives the same sentence read-only for the working paper.
export const gapNature = (track: 'design' | 'operating', nature: Nature): string =>
  track === 'design'
    ? (nature === 'Manual' ? 'Design gap — manual control' : 'Design gap — IT-dependent control')
    : (nature === 'Manual' ? 'Operating failure — manual control' : 'Operating failure — IT-dependent control');

// ─── PARKED (Aug 2026) — Gap type ────────────────────────────────────────────────
// Removed from the exception screen: derivable from the control's nature and the
// failed track, so it was a question with a knowable answer. Superseded by
// `gapNature` above. Kept commented so it can be restored.
// Note: 'Testing gap' here meant "designed fine, did not operate" — a real
// deficiency. It is NOT the same as an auditor who could not test; that case now
// lives on the control as `unableToTest` and never becomes an exception on its own.
//
// export type GapType = 'MDG' | 'ITDG' | 'TG';
// export const GAP_LABEL: Record<GapType, string> = {
//   MDG: 'Manual design gap',
//   ITDG: 'IT design gap',
//   TG: 'Testing gap',
// };
// export const GAP_HINT: Record<GapType, string> = {
//   MDG: 'Found in the walkthrough — the manual control as designed cannot prevent or detect the risk.',
//   ITDG: 'Found in the walkthrough — the system does not enforce what the control claims.',
//   TG: 'Found in sampling — the control is designed adequately but did not operate as designed.',
// };

// ─── PARKED (Aug 2026) — Priced impact ───────────────────────────────────────────
// Recovery / working-capital unblock / leakage are internal-audit VALUE metrics —
// what the gap was worth to the business. ICFR asks a different question: what
// could have been misstated. Those are not the same number and mixing them made
// the severity ladder read off the wrong one. Belongs on the Internal Audit
// engagement type; kept commented so it can be lifted across intact.
//
// export interface Exposure {
//   /** Recoverable from a counterparty — raise a debit note and get it back. */
//   recovery: number;
//   /** Cash sitting trapped that the fix releases — not a loss, a timing gain. */
//   workingCapital: number;
//   /** Gone. Value that left the business and isn't coming back. */
//   leakage: number;
//   /** How the numbers were arrived at — the arithmetic behind the claim. */
//   basis?: string;
// }
// export const EXPOSURE_LABEL: Record<Exclude<keyof Exposure, 'basis'>, string> = {
//   recovery: 'Recovery / debit note',
//   workingCapital: 'Working-capital unblock',
//   leakage: 'Leakage',
// };
// export const exposureTotal = (e?: Exposure): number =>
//   e ? e.recovery + e.workingCapital + e.leakage : 0;

/** One pass of the retest. The control is tested AGAIN — its own attributes, a
 *  fresh sample drawn from the period since the fix landed, item by item. A round
 *  is never edited: a failure appends the next round, which is what the loop
 *  counter counts. */
export interface RetestRound {
  /** 1-based. Two or more failed rounds put the exception in front of the reviewer. */
  n: number;
  /** The window the sample came off — from the day the fix landed, never earlier. */
  windowFrom: string;
  windowTo: string;
  /** The attributes carried over from the original test, verbatim. */
  attributes: { code: string; description: string }[];
  samples: { id: string; ref: string; date: string }[];
  /** sample id → attribute code → result. Any Fail fails the round. */
  results: Record<string, Record<string, TestResult>>;
  result: 'Pass' | 'Fail';
  /** Required on a failure — the owner reads this when the plan comes back. */
  rationale?: string;
  by: string;
  at: string;
}

export interface Deficiency {
  id: string;
  controlId: string;
  track: 'design' | 'operating';
  // PARKED (Aug 2026) — see the Gap type / Priced impact banners above.
  // gapType?: GapType;
  // exposure?: Exposure;
  /** Where this lands in the report — the source RACM's report reference number. */
  reportRef?: string;
  description: string;
  /** THE MECHANISM, not the symptom. "The system allows manual posting that
   *  bypasses approval", never "3 of 25 lacked approval" — the count is the
   *  evidence, this is the thing the fix has to change. Step 3's plan is judged
   *  against it, which is why it sits above the plan on screen. */
  rootCause: string;
  /** The sampled items that failed — what the exception was found in. */
  failedSamples?: string[];
  likelihood: Likelihood;
  magnitude: number;
  mwIndicators: string[];
  compensatingControlId?: string;
  aggregationGroup?: string;
  /** The auditor's "these two share a root cause" link. Process and assertion
   *  aggregate on their own from the control and the failed attributes; a shared
   *  mechanism cannot be read off free prose, so it is stated here instead. */
  rootCauseLinkId?: string;
  /** Reviewer's confirmation of a Significant Deficiency or worse. Nothing moves
   *  until this exists — a wrong rating must not drive weeks of remediation. */
  ratingConfirm?: { grade: string; by: string; at: string };
  /** Reviewer disagreed and sent the rating back to the auditor, with a reason. */
  ratingReturn?: { reason: string; by: string; at: string };
  // The owner's commitment: what will fix the ROOT CAUSE, who does it, by when —
  // and the evidence they attach before declaring it done (submit for retest).
  remediation: { action: string; date: string | null; owner: string; status: 'Open' | 'In progress' | 'Done'; evidence?: EvidenceFile[] };
  /** The owner has put the plan up for the auditor to judge. */
  planSubmitted?: { by: string; at: string };
  /** The auditor's verdict on the plan — does it address the root cause? A
   *  rejection carries the reason back to the owner. The auditor never writes
   *  or executes the fix; this is the whole of their say in it. */
  planReview?: { decision: 'Accepted' | 'Rejected'; reason?: string; by: string; at: string };
  /** The auditor's stated retest-ready date. Normally there is none: the date is
   *  DERIVED from the fix date plus the control's operating period, so storing it
   *  would just be a second copy that drifts. It is set only where the derivation
   *  cannot run — an ad-hoc control has no rhythm to count from — or where the
   *  auditor knowingly overrules it. Either way it wins over the calculation, and
   *  the screen says it was stated rather than computed. */
  expectedRetestReady?: string;
  // exception lifecycle
  status: ExceptionStatus;
  /** Every retest pass, oldest first. `retests.length` IS the loop counter. */
  retests?: RetestRound[];
  /** The round being worked right now — drawn, part-marked, not yet recorded.
   *  Separate from `retests` so an unfinished pass never counts as a failure. */
  retestDraft?: RetestRound;
  /** The latest round's verdict, mirrored for readers that only want the answer. */
  retest?: { result: 'Pass' | 'Fail'; at: string; by: string };
  signoff?: { by: string; at: string };
  // Prudent-official judgment: severity can be argued UP (never down) with a
  // recorded rationale — the handbook's judgment floor over the pure math.
  prudentOverride?: { to: Severity; rationale: string; by: string; at: string };
  /** Carried across when a control that could never be tested converts to an
   *  exception at period end — the working paper has to say why it was never
   *  evidenced, not just that it failed. */
  unableToTestReason?: string;
  /** The owner's disagreements with the grading, and what the auditor did with
   *  them. Oldest first — a contested rating keeps its argument. */
  challenges?: SeverityChallenge[];
}

// ─── The owner's challenge — disagreement with a record instead of a phone call ──
//
// SOX 404(a) is MANAGEMENT'S assessment of its own controls, and the process owner
// is management. They are not an opposing party to be kept from the file: they
// need the exposure to argue for budget, and the likelihood to rank this against
// everything else open on their desk.
//
// The real hazard was never that the owner reads the numbers. It is that they
// argue them down informally — a corridor conversation with the auditor, a grade
// that moves, and nothing on the paper saying why. So the numbers are shown, and
// the disagreement is given somewhere to go: a form, a routed item, an answer that
// must carry a reason, and a trail. A challenge changes NOTHING on its own. The
// auditor either adjusts an input — after which the engine re-grades, as it does
// for any other edit — or declines and says why.
/** What the grade MEANS for the person who has to act on it — who hears about it,
 *  and whether it has to be fixed and proven before the books close. The owner
 *  sees the label, the exposure and the likelihood; this is the sentence that
 *  turns those into a priority. Shared by the screen and the owner's brief so the
 *  two can never say different things about the same grade. */
export const SEVERITY_URGENCY: Record<string, string> = {
  'Clearly Trivial': 'Logged for the record. No fix is being asked for.',
  'Deficiency': 'A fix is expected, by the date agreed below.',
  'Significant Deficiency': 'Serious enough that senior finance and the audit committee are told about it — the date below is a commitment, not an estimate.',
  'Material Weakness': 'The most serious grade. It is reported outside the company, and it has to be fixed and proven to work before the books close.',
};

export type ChallengedInput = 'exposure' | 'likelihood' | 'compensating control';
export const CHALLENGED_INPUT_LABEL: Record<ChallengedInput, string> = {
  exposure: 'Exposure — what could have slipped through',
  likelihood: 'Likelihood — how probable it was',
  'compensating control': 'Compensating control — something else already catches this',
};
export interface SeverityChallenge {
  id: string;
  /** Which of the three inputs is disputed. Not the grade itself: the grade is
   *  computed, so arguing with it means arguing with one of its inputs. */
  input: ChallengedInput;
  reasoning: string;
  evidence?: EvidenceFile[];
  by: string;
  at: string;
  /** The grade standing when the challenge was raised, so the history reads as an
   *  argument about a specific number rather than about the current one. */
  gradeAtRaise: string;
  /** Absent while it is still with the auditor. A reason is required either way —
   *  "declined" with no words is the informal lobbying this exists to replace. */
  response?: { decision: 'Accepted' | 'Declined'; reason: string; by: string; at: string };
}

// The six steps, as eight states — two of the steps have a handoff inside them.
// Sizing parks for the reviewer when it lands on Significant Deficiency or worse;
// planning parks for the auditor to judge the plan against the root cause. A
// passed retest parks at 'Awaiting reviewer' — only the reviewer closes (four-eyes).
export type ExceptionStatus =
  | 'Identified'          // ① raised + ② the auditor sizes it
  | 'Rating review'       // ② reviewer confirms Significant Deficiency or worse — blocking
  | 'Planning'            // ③ risk owner writes the plan
  | 'Plan review'         // ③ auditor judges it against the root cause
  | 'Remediation'         // ④ risk owner implements and attaches evidence
  | 'Retest'              // ⑤ auditor retests on a post-fix sample
  | 'Awaiting reviewer'   // ⑥ reviewer reads the retest evidence
  | 'Closed';             // ⑥ reviewer has signed off

/** The six steps as the screen shows them, and where each state sits. */
export const EXCEPTION_STEPS: { n: number; title: string; role: Role; states: ExceptionStatus[] }[] = [
  { n: 1, title: 'Exception raised', role: 'auditor', states: ['Identified'] },
  { n: 2, title: 'Size it', role: 'auditor', states: ['Identified', 'Rating review'] },
  { n: 3, title: 'Plan the fix', role: 'risk-owner', states: ['Planning', 'Plan review'] },
  { n: 4, title: 'Fix and submit', role: 'risk-owner', states: ['Remediation'] },
  { n: 5, title: 'Retest', role: 'auditor', states: ['Retest'] },
  { n: 6, title: 'Close', role: 'reviewer', states: ['Awaiting reviewer', 'Closed'] },
];

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
  | 'override' | 'request-docs' | 'receive-doc' | 'waive-doc' | 'walkthrough' | 'ipe' | 'population' | 'sample' | 'reopen' | 'wp-signoff' | 'review-return' | 'exception' | 'challenge';
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
  /** What it was and what it became. A trail that says only "something changed"
   *  cannot be audited; a severity that moved has to show which way. */
  from?: string;
  to?: string;
  /** Why — required by the flow wherever a decision goes against the obvious
   *  reading: a rejected plan, a failed retest, a raised grade, a reopen. */
  rationale?: string;
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
/** The round's short stamp, used on the population version (POP-INT / POP-RF /
 *  POP-YE). Shared so the seed and the tester cannot drift apart on it — a
 *  population's tag is the only thing on screen that says which round it was
 *  pulled for. */
export const ROUND_TAG: Record<AuditRound, string> = { interim: 'INT', rollforward: 'RF', yearend: 'YE' };
/** The same rounds in prose, for a filter line a human reads. */
export const ROUND_WINDOW_LABEL: Record<AuditRound, string> = { interim: 'interim window', rollforward: 'roll-forward window', yearend: 'year-end window' };

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
  /** Where the auditor overruled the derived entity scope, and why. Absent when
   *  the audit took the trial balance's answer as it stood, or was scoped by
   *  RACM. Every entry carries a reason — the wizard won't leave the scope step
   *  with an unexplained change in it. */
  scopeNotes?: { entityId: string; name: string; inScope: boolean; note: string }[];
  /** Simulated TB / GL uploads; empty when the step was skipped. */
  files: { name: string; kind: 'tb' | 'gl' }[];
  /** The rule as set on the materiality step. Shape is inlined rather than
   *  imported from soxTestingData — this module deliberately has no imports,
   *  and the audit freezes its own copy anyway, so later edits to the
   *  programme's rules don't rewrite history.
   *
   *  pmPct / ctPct are performance materiality and the clearly-trivial floor as
   *  percentages OF overall — the two thresholds testing actually runs against.
   *  Optional because audits created before the wizard asked for them have
   *  neither; readers fall back to the SOX-standard 75 / 5. */
  materiality: { basisLabel: string; benchmark: number; pct: number; pmPct?: number; ctPct?: number };
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
  /** The audit's file registry — every file that entered, with where it came
   *  from. Holds the files uploaded through the app and any answer corrected
   *  afterwards; files the engagement derives from scoping are merged in on
   *  read (see useAuditFiles) so a record only has to exist where somebody
   *  actually said something. */
  fileRegistry?: AuditFileRecord[];
}

export const DESIGN_DOC_KINDS: DesignDocKind[] = ['Process narrative', 'Flowchart', 'Walkthrough', 'Control description', 'Policy / SOP', 'Precision & thresholds', 'Segregation of duties'];

// PARKED (Aug 2026) — the exception no longer carries a gap type. `gapNature`
// derives the same sentence read-only from the track and the control's nature.
//
// export const defaultGapType = (track: 'design' | 'operating', nature: Nature): GapType =>
//   (track === 'operating' ? 'TG' : nature === 'Manual' ? 'MDG' : 'ITDG');

/** The checks every entity-produced report answers before it is relied on.
 *  Period coverage joined the original three in Aug 2026, off the parked
 *  "Checked automatically" row — same question, answered by a person now.
 *  Seeded when the report is registered so the auditor tests, never authors. */
export const ipeChecklist = (reportLabel: string): Omit<IpeCheck, 'id'>[] => [
  {
    dimension: 'Source & parameters',
    description: `${reportLabel} was run from the live system over the audit period, with the scoping filters the test assumes.`,
    method: 'Inspect the parameter screen capture — system, company code, date range and document types — and agree each to the test scope.',
    result: 'Not tested',
  },
  {
    // Was the "Period covered" row under "Checked automatically", where the
    // application measured the extract's span against the audit window and went
    // green on its own. It is a person's check now: the arithmetic never knew
    // whether a month with no instances is a hole in the extract or a month the
    // control genuinely did not run in, and that is the whole question.
    dimension: 'Period coverage',
    description: 'The extract spans the whole audit period — and where a month inside it is empty, that is the control not running, not the extract stopping short.',
    method: 'Agree the earliest and latest instance to the audit period, and account for any month inside it with no instances.',
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

/** What the checks add up to. A single failure sinks the report — an
 *  incomplete population is the wrong population, not a slightly worse one. */
export const ipeSuggestion = (t: IpeTest): IpeConclusion =>
  t.checks.some(c => c.result === 'Fail') ? 'Not reliable'
    : t.checks.length > 0 && t.checks.every(c => c.result === 'Pass') ? 'Reliable'
    : 'Not tested';

/** The gate the sample step sits behind: no reliable report, nothing to sample. */
export const ipeReliable = (o: OperatingTrack): boolean => o.ipe?.conclusion === 'Reliable';
