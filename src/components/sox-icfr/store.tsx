import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { racmTemplateForProcesses, requiredDatasetsFor, sampleRefs, seedIcfrEngagement, type SeedMeta } from './mockData';
import { assessSeverity, attestationOverruled, designApproved, designFilesOf, iraCannotTest, designRetestChecks, designOutstanding, fmtDateTime, requiredFilesOf, requiredFilesReady, canExtendToe, canRedrawToe, controlConclusion, reconcileConfirmations, formatINR, gradeException, icfrConclusion, inquiryOnlyAttributes, passedWithoutFiles, isControlLocked, isControlLockedIn, isEngagementLocked, itgcHolds, parseLooseDate, samePerson, samplingOf, populationSources, previewRegrades, sampleSizeGuide, samplesFor, sourceTotals, staleSteps, stepResult, designCheckQA, TOE_MAX_ROUNDS, toeRoundFailed, toeRoundNo, toeRounds, trackResult, validationQA, validationSummary, validationTable, wfRunRef, dealSample, samplesTestedCount, sampleHome, spreadPhrase, workingAudit, yearEndPending, LEGACY_SOURCE_ID, type RulesPatch } from './helpers';
import type {
  Assertion, Attestation, AuditArchive, AuditFileRecord, AuditorProof, AuditRecord, Control, ControlClass, Deficiency, DesignDoc, DesignDocKind, DesignPoint, DiscussionAnchor, DocStatus, FileOrigin,
  DesignJudgements, DesignWaiverReason, EvidenceFile, EvidenceMode, ExceptionStatus, ExecKind, ExecutionEvent, Frequency, HandoffTask, IcfrEngagement,
  DesignBasis, DesignTrack, EvidenceType, ExceptionKind, IpeConclusion, PopulationChecks, IpeTest, MaterialityRules, Walkthrough, Nature, OperatingStep, Override, Population, PopulationDefinition, RacmReview, Role, RulesChangeEntry, RunControlOutcome, RunRecord, ScopeArchiveEntry,
  PopulationSource, RequiredFile, Sample, Sampling, SamplingChangeEntry, SamplingMethodology, SamplingRoundBasis, SignificantAccount, SourceRole, TestingStrategy, TestResult, ToeRound, TrackConclusion, RetestRound, UnableToTest, ChallengedInput, SeverityChallenge,
} from './types';

let _uid = 0;
const uid = (p: string) => `${p}-${(++_uid).toString(36)}`;

/**
 * A control returned to the state a fresh audit finds it in: both tracks Not
 * tested, and the journey back at zero.
 *
 * Not tested has to mean untouched, not just unconcluded. `designStarted` reads
 * a Received design document and `operatingStarted` reads a drawn population —
 * so a control whose conclusions were cleared but whose evidence survived still
 * reports "In progress", and the auditor arrives at a step already half-walked.
 * A new cycle proves itself with the new cycle's evidence.
 *
 * The working paper is emptied, not just uncleared. Both tracks open on their
 * "isn't set up yet" first state, which each renders only when its lists are
 * empty — design on `documents.length === 0 && points.length === 0`, operating
 * on `steps.length === 0`. Leaving the rows behind as Missing would drop the
 * auditor into a paper someone else had already framed.
 *
 * What goes: the design elements and design checks, the test attributes and how
 * each was evidenced, both tracks' conclusions and overrides, the population and
 * the IPE behind it, the drawn sample and its per-item results, every
 * attestation and uploaded file, and the paper's sign-offs.
 *
 * What stays: the control — its description, risk, assertions, owner, nature,
 * frequency, precision. That is the RACM row, and the RACM is confirmed at
 * scoping, not re-authored per cycle. Everything above is the working paper the
 * auditor builds on top of it, and each cycle builds its own.
 */
function untested(c: Control): Control {
  return {
    ...c,
    // The paper is this cycle's. A signature on last cycle's conclusions cannot
    // stand over results that no longer exist.
    wpSignoff: undefined,
    reviewReturn: undefined,
    reopened: undefined,
    design: {
      ...c.design,
      conclusion: 'Not tested',
      // A carry is one roll-forward's statement about one interim — it does
      // not survive into the cycle after that.
      carriedFrom: undefined,
      override: undefined,
      testedBy: null,
      testedAt: null,
      documents: [],
      points: [],
      // The walkthrough walked one transaction from last cycle's period, with the
      // people who were in that room. It cannot speak for this cycle.
      walkthrough: undefined,
      // Ira's last read was of last cycle's checks, and they are gone.
      ira: undefined,
      // An approval is of a conclusion, and there is no conclusion any more.
      approval: undefined,
      designReturn: undefined,
    },
    operating: {
      ...c.operating,
      conclusion: 'Not tested',
      override: undefined,
      testedBy: null,
      testedAt: null,
      // Period-bound: the population is an extract over last cycle's dates, and
      // the IPE test behind it proved THAT extract — a report re-run for a new
      // period is a new report, and has to be tested again.
      ipe: undefined,
      population: undefined,
      sampling: undefined,
      steps: [],
    },
  };
}
/** What gets logged for one execution — actor/id/time are stamped by pushExec. */
type ExecDraft = { controlId: string; track: 'design' | 'operating'; kind: ExecKind; verb: string; target?: string; result?: TestResult | TrackConclusion };
const short = (s: string, n = 40) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// The two questions Ira's design read can answer before it looks at the design
// itself (S6, A17). Kept as constants because the next run reads them back: a
// check Ira failed only for a missing element must not stay failed once the
// element arrives, and the second line is how it remembers the check had
// already been marked failed before that.
const IRA_ON_FILE_Q = 'Is every required design element on file?';
const IRA_STOOD_FAILED_Q = 'Was this check already marked failed?';
const IRA_COULD_TEST_Q = 'Is there anything on file that answers this check?';
// The retest's version of the first question: a TOD retest reads the fix, so what
// has to be on file is the owner's evidence of it, not the design elements.
const RETEST_FIX_ON_FILE_Q = 'Is the evidence of the fix on file?';

/** The design-track retest round in progress, started if there is none — there
 *  is no sample to draw, so the first mark or Ira run is the start. A sampled
 *  draft sitting on a design exception was never the right retest and never
 *  recorded, so it is replaced rather than kept. Null when there is nothing to
 *  re-check (a control with no design checks at all). */
function designRetestDraft(state: IcfrEngagement, target: Deficiency, by: string): RetestRound | null {
  if (target.retestDraft?.checks?.length) return target.retestDraft;
  const checks = designRetestChecks(target, state.controls.find(x => x.id === target.controlId));
  if (!checks.length) return null;
  const iso = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  return {
    n: (target.retests?.length ?? 0) + 1,
    windowFrom: iso(parseLooseDate(target.remediation.date) ?? new Date()), windowTo: iso(new Date()),
    attributes: [], samples: [], results: {},
    checks: checks.map(x => ({ ...x, result: 'Not tested' as TestResult })),
    result: 'Fail', by, at: 'just now',
  };
}

// When a flow concludes an attribute wholesale (workflow pull, AI validation,
// attestation, test-all, bulk), stamp the per-sample grain to match: pass ⇒ every
// drawn sample passes; fail ⇒ one exemplar item fails, the rest pass.
const stampSamples = (c: Control, s: OperatingStep, res: TestResult): OperatingStep => {
  const samp = c.operating.sampling;
  if (!samp || res === 'Not tested') return s;
  const m: Record<string, TestResult> = {};
  samp.samples.forEach((it, i) => { m[it.id] = res === 'Fail' && i === 0 ? 'Fail' : 'Pass'; });
  return { ...s, sampleResults: m };
};
// PARKED (Aug 2026): `defaultGapType` — the exception no longer carries a gap type.
import { ipeChecklist, ROLE_LABEL, spreadLabel } from './types';
import { auditCovers, captionsFor, countryOf, entitiesFor, inScopeEntityNames, isOwnerOf, normaliseProcess, ownersOf, peopleForProcess, processesForAudit, racmAuditUse, scopedForDraw } from './auditScope';
import { rootCauseReady, seedKeyOf, suggestRootCause, suggestSizing, type ExposureContext } from './helpers';
import { entityCodeFor, processCodeFor, riskIdOf } from './racmIds';
import { controlIdClashes, copyRacmControls, findLibraryRacm, markRacmsUsed } from './racmLibrary';
import { findEngagement, registerEngagement } from '../../data/engagements';
import { useToast } from '../shared/Toast';
import { defWord } from './flow';

// ─── You cannot audit what you own ──────────────────────────────────────────────
// The one prohibition that cannot be expressed as a role: the person who runs a
// control is not independent of it, whichever hat they put on. So it is checked by
// NAME against that control's own owners — putting on a different hat must not
// change the answer. Holding two roles across DIFFERENT controls stays legal,
// which is exactly why this is asked per control and not per engagement.
function ownsIt(state: IcfrEngagement, controlId: string, person: string): boolean {
  const c = state.controls.find(x => x.id === controlId);
  return !!c && isOwnerOf(c, person);
}


// The five primary tabs — mirrors how other engagements are laid out.
// 'deficiencies' is a TAB now, not a drill-in: deficiency management is a place
// you go, not somewhere you land from an Overview card.
export type SoxTab = 'overview' | 'racm' | 'risks' | 'controls' | 'runs' | 'deficiencies' | 'config';
// 'overview' | 'racm'(card) | 'racm-list'(matrix) | 'risks' | 'register'(=Control Library) | 'runs' | 'config'
// are root-level views; the rest are drill-ins reached from them.
/** Which step on the control page a navigation was about. One value today —
 *  the list grows as other rows learn to name where they land. */
export type FocusStep = 'population';

type View = 'overview' | 'racm' | 'racm-list' | 'racm-editor' | 'risks' | 'register' | 'runs' | 'config' | 'dossier' | 'deficiencies' | 'scope' | 'handoffs';
export interface RacmEditorMeta { name: string; process?: string }

const TAB_ROOT: Record<SoxTab, View> = { overview: 'overview', racm: 'racm', risks: 'risks', controls: 'register', runs: 'runs', deficiencies: 'deficiencies', config: 'config' };

/** What a drill-in can return to — everything except the drill-ins themselves. */
const RETURNABLE: View[] = ['overview', 'racm', 'racm-list', 'risks', 'register', 'runs', 'config', 'deficiencies', 'scope', 'handoffs'];

/** The create-control form's payload — everything else on the Control is derived. */
export interface NewControlDraft {
  description: string;
  /** The RACM's Control Activity narrative — optional, because a control can be
   *  raised from the one-line statement and written up afterwards. */
  controlActivity?: string;
  process: string;
  subProcess: string;
  riskId: string;
  /** The risk's short name, where the form was given one. Optional: a hand-raised
   *  control may only have the sentence, and an empty title stays empty rather
   *  than being shortened behind the auditor's back. */
  riskTitle?: string;
  riskDescription: string;
  nature: Nature;
  frequency: Frequency;
  /** Accountable for the control. */
  owner: string;
  /** Runs the process, and is who evidence requests reach. Falls back to the
   *  process's people from the scoping wizard, then to `owner`. */
  processOwner?: string;
  isKey: boolean;
  assertions: Assertion[];
  /** When the control started operating in its current form. */
  effectiveDate?: string;
  /** How much of the population gets tested. Defaults to Sampling at creation. */
  testingStrategy?: TestingStrategy;
  /** Preventive or Detective. The New control form always names it (22 Sep);
   *  the scope step's quick add doesn't, and stays Preventive as before. */
  type?: Control['type'];
  /** Accountable for the risk — a record only. Absent means "same as process
   *  owner", which `ownersOf().riskOwner` resolves at read time. */
  riskOwner?: string;
  /** Which of the six the risk is (22 Sep). Required on the New control form;
   *  the scope step's quick add doesn't ask, and leaves it unset. */
  clazz?: ControlClass;
  /** Design checks for the TOD — land as control-level design points. */
  designChecks?: string[];
  /** Test attributes for the TOE — land as operating steps. */
  attributes?: string[];
}

interface IcfrCtx {
  eng: IcfrEngagement;
  role: Role;
  tab: SoxTab;
  view: View;
  selectedControlId: string | null;
  racmEditor: RacmEditorMeta | null;
  me: string;
  // which first-line persona "You" wears in owner mode — drives all owner scoping
  meOwner: string;
  setMeOwner: (owner: string) => void;
  racmProcess: string | null;
  setRole: (r: Role) => void;
  setTab: (t: SoxTab) => void;
  setView: (v: View) => void;
  openRacmMatrix: (process: string) => void;
  openRacmEditor: (meta: RacmEditorMeta) => void;
  /** Open a control. `focus` names the step the click was about, so a row that
   *  says "upload the source data" lands on the Population step rather than
   *  at the top of a five-step page. Consumed once on arrival — coming back
   *  later should land nowhere in particular. */
  openControl: (id: string, focus?: FocusStep) => void;
  focusStep: FocusStep | null;
  clearFocusStep: () => void;
  /** Open ONE exception, wherever it lives — the audit that owns it, the
   *  deficiencies tab inside it, and that card expanded and scrolled to. A row
   *  that names a specific finding should land on that finding, not on a list
   *  the reader then has to search for the thing they just clicked. */
  openDeficiency: (defId: string) => void;
  /** The exception a navigation asked for, consumed once by the card. */
  focusDefId: string | null;
  clearFocusDef: () => void;
  back: () => void;
  // where back() would land — the dossier breadcrumb names it honestly
  returnView: View | null;
  // Overview → Control Library with intent: the clicked count's exact view/filter
  registerPreset: { view?: string; process?: string } | null;
  openRegister: (preset: { view?: string; process?: string }) => void;
  clearRegisterPreset: () => void;
  /** Overview → RACM tab with its Create chooser already open. Consumed once by
   *  the landing, so the upload flow has one home and two doors into it. */
  racmCreateOpen: boolean;
  openRacmCreate: () => void;
  clearRacmCreate: () => void;
  // design track
  setDocStatus: (controlId: string, docId: string, status: DocStatus) => void;
  setDesignPoint: (controlId: string, pointId: string, result: TestResult) => void;
  concludeDesign: (controlId: string, conclusion: TrackConclusion, rationale?: string) => void;
  overrideDesign: (controlId: string, override: Override | null) => void;
  // design sign-off after TOD (S6, A36) — the reviewer approves a concluded TOD,
  // or sends it back to the auditor with a note. Population, Sample and TOE wait on it.
  approveDesign: (controlId: string) => void;
  returnDesign: (controlId: string, note: string) => void;
  // design CRUD + validation
  // `custom` names an element the standard kinds don't cover — its title is the
  // name the auditor typed, and the description says what evidence is wanted
  addDesignDoc: (controlId: string, kind: DesignDocKind, custom?: { name: string; description?: string }) => void;
  /** Files picked off this machine, attached to one design element. The store
   *  stamps who uploaded them and when; the element keeps its own name. */
  attachDesignEvidence: (controlId: string, docId: string, files: Pick<EvidenceFile, 'name' | 'kind' | 'url'>[]) => void;
  /** One file off a design element — the last one takes it back to Missing. */
  removeDesignFile: (controlId: string, docId: string, fileId: string) => void;
  removeDesignDoc: (controlId: string, docId: string) => void;
  /** Account for a required element that will never arrive — audit-team prepared,
   *  inspected at the client, or not applicable. Recorded with a reason, and it
   *  stops gating the conclusion. */
  waiveDesignDoc: (controlId: string, docId: string, reason: DesignWaiverReason, note: string) => void;
  clearDesignWaiver: (controlId: string, docId: string) => void;
  /** Edit the control's own identity — objective, classification, key judgement,
   *  risk rating. Key/non-key and the rating are agreed with management, never
   *  read off an SOP, so they have to be editable rather than displayed. */
  updateControlMeta: (controlId: string, patch: Pick<Partial<Control>, 'objective' | 'clazz' | 'isKey' | 'riskRating' | 'owner' | 'processOwner'>) => void;
  /** Key / non-key, set while an audit is being SCOPED — see `setControlKey`. */
  setControlKey: (controlId: string, isKey: boolean) => void;
  /** The design judgements the paper states — 5W+1H coverage, compensating
   *  control, is the frequency right, is the type right. */
  setDesignJudgements: (controlId: string, patch: Partial<DesignJudgements>) => void;
  /** The walkthrough — design tested against one transaction, on the same
   *  attributes the sample will test. */
  startWalkthrough: (controlId: string) => void;
  setWalkthroughAttribute: (controlId: string, stepId: string, result: TestResult) => void;
  setWalkthroughMeta: (controlId: string, patch: Partial<Pick<Walkthrough, 'date' | 'tester' | 'attendees' | 'notes'>>) => void;
  /** `stepId` files the check under one attribute; omit it for a control-level
   *  check. See DesignPoint.stepId — both kinds share the one array. */
  addDesignPoint: (controlId: string, text: string, stepId?: string) => void;
  removeDesignPoint: (controlId: string, pointId: string) => void;
  validateDesignPoint: (controlId: string, pointId: string) => void;
  overrideDesignPoint: (controlId: string, pointId: string, override: Override | null) => void;
  /** Ira reads every design check against the elements on file and marks each
   *  Pass or Fail. Run on the auditor's ask, never on upload. */
  runDesignIra: (controlId: string) => void;
  /** Point a design check at the elements that evidence it — ids only, never a copy. */
  linkDesignPointEvidence: (controlId: string, pointId: string, docIds: string[]) => void;
  /** The auditor's own proof on a check. One slot; null clears it. */
  setDesignPointProof: (controlId: string, pointId: string, proof: AuditorProof | null) => void;
  requestDataByEmail: (controlId: string, docIds: string[], emails: string[]) => void;
  // operating track
  setPopulation: (controlId: string, population: Population) => void;
  /** How a design consideration or an attribute was proven — inquiry through to
   *  reperformance. Design warns on inquiry alone; operating refuses to pass. */
  setPointEvidenceType: (controlId: string, pointId: string, type: EvidenceType) => void;
  setStepEvidenceType: (controlId: string, stepId: string, type: EvidenceType) => void;
  /** The two facts the design conclusion has to state beyond effective/not:
   *  whether the control is actually in operation, and what the conclusion rests on. */
  setDesignBasis: (controlId: string, patch: { implemented?: boolean; basis?: DesignBasis }) => void;
  /** Step ① — what the population is, before anything is pulled into it. */
  setPopulationDefinition: (controlId: string, def: Omit<PopulationDefinition, 'by' | 'at'>) => void;
  /** Withdraw the population and everything drawn from it — a different extract
   *  is a different population, and the sample off the old one means nothing. */
  clearPopulation: (controlId: string) => void;
  /** PARKED — tick one of the three pre-lock checks. */
  setPopulationCheck: (controlId: string, key: keyof PopulationChecks, value: boolean) => void;
  /** Record what the application cannot derive: where the extract came from, the
   *  expected count where the frequency gives none, and the reason a computed
   *  check was overridden. */
  setPopulationFacts: (controlId: string, patch: Partial<Pick<Population, 'provenance' | 'countConfirmed' | 'countNote' | 'coverageNote'>>) => void;
  /** Add one more source file to a population that already has one — a control
   *  standing on a general ledger and a vendor master, or on four quarterly
   *  extracts. The file arrives with its own four IPE checks, unproven. */
  addPopulationSource: (controlId: string, src: Omit<PopulationSource, 'id' | 'draw'>) => void;
  /** Drop ONE source file. Its checks and the items drawn off it go with it, and
   *  nothing else does — the other files' proof and testing were never in
   *  question. Dropping the last one withdraws the population outright. */
  removePopulationSource: (controlId: string, sourceId: string) => void;
  /** Say whether a file is the population or a table joined onto it. Turning a
   *  sampled file into an assisting one throws its sample away — an assisting
   *  table has no items to test. */
  setSourceRole: (controlId: string, sourceId: string, role: SourceRole) => void;
  /** Record the draw made off ONE file: how many, how, and the items it landed
   *  on. They join the control's one list of sampled items, tagged with the file
   *  they came out of. */
  drawSourceSample: (controlId: string, sourceId: string, draw: NonNullable<PopulationSource['draw']>, refs: string[]) => void;
  /** Tick one file's accordion — its proof or its draw is done and the next file
   *  is next. A marker, not a lock: `on: false` takes it back off. */
  approveSource: (controlId: string, sourceId: string, which: 'ipe' | 'sample', on: boolean) => void;
  /** Throw one file's drawn items back and reopen its draw. The auditor read the
   *  sample and did not like it — every other file keeps its own. */
  redrawSource: (controlId: string, sourceId: string) => void;
  /** Ask the control's owner to come and upload the source data. The population
   *  is theirs to derive, so a missing file is a thing to chase rather than a
   *  thing for the auditor to work around. */
  remindOwnerForFiles: (controlId: string, what: string) => void;
  /** Put a file into the audit's registry — name, size, who brought it in and
   *  where it came from. Answered once here; every population inherits it. */
  registerFile: (rec: AuditFileRecord) => void;
  /** Correct a file's provenance. The only place it can be changed: it belongs
   *  to the file, not to any control that read it. Concluded controls sourced
   *  from the file are flagged for review rather than silently restated. */
  setFileOrigin: (name: string, origin: FileOrigin) => void;
  /** Lock it. Nothing downstream runs until this has happened. */
  lockPopulation: (controlId: string) => void;
  /** Step ③ — freeze the attributes the sample will be tested against, or reopen
   *  them. What each item proves cannot keep moving once testing starts. */
  lockAttributes: (controlId: string, locked: boolean) => void;
  /** IPE gate 2 — the drawn items trace to the locked population, and the method
   *  and seed are on the paper. */
  confirmExtraction: (controlId: string) => void;
  /** Judge one failure: the control didn't work, or a one-off that can't recur. */
  recordException: (controlId: string, sampleId: string, stepId: string, kind: ExceptionKind, reason: string) => void;
  /** IPE gate 3 — prove one report standing behind the evidence. */
  proveEvidenceReport: (controlId: string, reportId: string, note?: string) => void;
  addEvidenceReport: (controlId: string, name: string, usedFor: string, insideControl?: boolean) => void;
  removeEvidenceReport: (controlId: string, reportId: string) => void;
  // IPE — the entity-produced report is registered, its three checks are worked,
  // then it is concluded. Until it concludes Reliable there is nothing to sample.
  registerIpe: (controlId: string, meta: Omit<IpeTest, 'checks' | 'conclusion' | 'testedBy' | 'testedAt'>) => void;
  setIpeCheck: (controlId: string, checkId: string, patch: { result?: TestResult; note?: string; evidence?: EvidenceFile[] }) => void;
  concludeIpe: (controlId: string, conclusion: IpeConclusion) => void;
  /** Unregister the report — the wrong extract was tested, so the work goes with it. */
  clearIpe: (controlId: string) => void;
  setMrc: (controlId: string, isMrc: boolean, threshold?: number) => void;
  updateAccount: (id: string, patch: Partial<SignificantAccount>) => void;
  setSampling: (controlId: string, sampling: Sampling) => void;
  extendSample: (controlId: string, extra: number) => void;
  /** A departure from the agreed sizing table (#22) — refused without a reason. */
  resizeSample: (controlId: string, size: number, reason: string) => void;
  setSampleResult: (controlId: string, stepId: string, sampleId: string, result: TestResult) => void;
  setStepResult: (controlId: string, stepId: string, result: TestResult) => void;
  overrideStep: (controlId: string, stepId: string, override: Override | null) => void;
  pullStepRun: (controlId: string, stepId: string) => void;
  attestStep: (controlId: string, stepId: string, note: string, result: 'Pass' | 'Fail') => void;
  addStepEvidence: (controlId: string, stepId: string, fileName: string) => void;
  setStepInputFile: (controlId: string, stepId: string, fileName: string) => void;
  concludeOperating: (controlId: string, conclusion: TrackConclusion, rationale?: string) => void;
  overrideOperating: (controlId: string, override: Override | null) => void;
  /** Set the failed round aside and reopen the draw — see ToeRound. The reason
   *  is not optional: without one this is drawing until a clean sample appears. */
  startToeRound: (controlId: string, reason: string) => void;
  // operating CRUD + workflow mapping + attest toggle + test-all
  addAttribute: (controlId: string, description: string) => void;
  removeAttribute: (controlId: string, stepId: string) => void;
  mapStepWorkflow: (controlId: string, stepId: string, name: string) => void;
  setStepEvidenceMode: (controlId: string, stepId: string, mode: EvidenceMode) => void;
  toggleStepAttest: (controlId: string, stepId: string, enabled: boolean) => void;
  toggleStepAI: (controlId: string, stepId: string, on: boolean) => void;
  runStepValidation: (controlId: string, stepId: string) => void;
  testAllAttributes: (controlId: string) => void;
  // Required files — the evidence each attribute's AI validation runs against.
  // The list is edited on the engagement control page; uploads happen in TOE.
  addRequiredFile: (controlId: string, stepId: string, label: string) => void;
  renameRequiredFile: (controlId: string, stepId: string, fileId: string, label: string) => void;
  removeRequiredFile: (controlId: string, stepId: string, fileId: string) => void;
  uploadRequiredFile: (controlId: string, stepId: string, fileId: string, fileName: string) => void;
  clearRequiredFile: (controlId: string, stepId: string, fileId: string) => void;
  /** Run AI validation on every attribute whose required files are all in;
   *  the rest are left untouched. */
  validateReadyAttributes: (controlId: string) => void;
  // RACM row review — auditor approval / remark, plus bulk testing
  approveRacmRows: (controlIds: string[]) => void;
  remarkRacmRow: (controlId: string, remark: string) => void;
  clearRacmReview: (controlId: string) => void;
  bulkTestControls: (controlIds: string[]) => void;
  // Audit logs tab — the New audit wizard hands back everything but the
  // stamp (id / by / role / at), which the store adds.
  /** `freshControlIds`: controls created inside the New audit wizard itself.
   *  They have no earlier cycle to archive or reset, so they keep the design
   *  checks typed in on the form. */
  createAudit: (draft: Omit<AuditRecord, 'id' | 'by' | 'role' | 'at'>, opts?: { freshControlIds?: string[] }) => void;
  /** Edit an audit from its own Configuration tab. The stamp (who / when) is
   *  left alone — it records creation, not the last touch. */
  updateAudit: (auditId: string, patch: Partial<Omit<AuditRecord, 'id' | 'by' | 'role' | 'at'>>) => void;
  /** Which audit is open. Permanently null now that the audit level is removed
   *  (see Inner in SoxIcfrApp) — nothing calls openAudit. Kept wired because the
   *  readers below (useAuditControls, the dossier's file list) already handle
   *  null by falling back to engagement-level defaults, and because restoring
   *  the level should not mean rebuilding the store. */
  openAuditId: string | null;
  openAudit: (auditId: string) => void;
  closeAudit: () => void;
  // RACM / SOP source documents uploaded on the RACM page
  // an uploaded RACM/SOP belongs to ONE process's matrix (a RACM is per-process);
  // docs without a process are legacy engagement-wide pins and show everywhere
  /** Files a RACM came from. `source` says whether it was a workbook or an SOP;
   *  `url` is a link to the uploaded file for this session, so View SOP can
   *  open it (absent on seeded documents and after a reload). */
  racmDocs: (EvidenceFile & { process?: string; source?: 'racm' | 'sop'; url?: string })[];
  addRacmDoc: (fileName: string, process?: string, opts?: { source?: 'racm' | 'sop'; url?: string }) => void;
  // a RACM here IS a process's set of controls, so creating one brings a new
  // process into scope and seeds its risks & controls from the template
  /** `opts.controls`: the controls read out of the uploaded file (or accepted
   *  from an SOP extraction). Omitted → the process's template, as before. */
  createRacm: (process: string, sourceFileName?: string, entity?: string, opts?: { controls?: Control[]; source?: 'racm' | 'sop'; url?: string }) => void;
  /** Delete a process's RACM and its controls — refused while any audit covers them. */
  deleteRacm: (process: string) => void;
  /** "Add RACM" (S11): copy RACMs from the Engagements page's RACM tab into this
   *  engagement. Refused (0) when any control ID would clash with one already
   *  here or between the RACMs. Returns how many controls came in. */
  addLibraryRacms: (racmIds: string[]) => number;
  // discussions
  addComment: (controlId: string, anchor: DiscussionAnchor, text: string) => void;
  resolveDiscussion: (discussionId: string, resolved: boolean) => void;
  // handoffs
  submitTask: (taskId: string) => void;
  clearTask: (taskId: string) => void;
  raiseQuery: (controlId: string, title: string, detail: string) => void;
  requestDesignDocs: (controlIds: string[]) => void;
  // materiality rules
  updateRules: (patch: Partial<MaterialityRules>) => void;
  applyRules: (patch: RulesPatch, reason: string) => void;
  updateMateriality: (patch: { materiality?: number; performanceMateriality?: number }) => void;
  /** Configuration tab — after a scope re-derive, reconcile the live control
   *  set: keep controls of still-in-scope processes, seed fresh shells for
   *  newly-scoped ones, drop the rest. */
  reconcileScope: (processes: string[]) => void;
  // deficiencies / exception lifecycle — the six steps
  /** Put an exception in a root-cause group — an existing one, or a new one
   *  named here with the exceptions it is being linked to. */
  linkRootCause: (id: string, target: { groupId: string } | { name: string; withIds: string[] }) => void;
  unlinkRootCause: (id: string, groupId: string) => void;
  /** File the judgement that a group's members do not compound. The group and
   *  its combined grade both stand — see setGroupConclusion. */
  setGroupConclusion: (groupKey: string, note: string) => void;
  updateDeficiency: (id: string, patch: Partial<Deficiency>) => void;
  setExceptionStatus: (id: string, status: ExceptionStatus) => void;
  /** ② the auditor is done sizing — to the reviewer if significant or worse,
   *  otherwise straight to the owner to plan. */
  completeSizing: (id: string) => void;
  /** ② the reviewer agrees the grade, or sends it back with a reason. */
  confirmRating: (id: string) => void;
  returnRating: (id: string, reason: string) => void;
  /** ③ the owner puts the plan up; the auditor judges it against the root cause
   *  and nothing else. A rejection must carry a reason. */
  submitPlan: (id: string) => void;
  reviewPlan: (id: string, decision: 'Accepted' | 'Rejected', reason?: string) => void;
  /** ⑤ a fresh sample off the post-fix period, marked against the original
   *  attributes, item by item. The verdict is derived from the grid, never typed. */
  drawRetestSample: (id: string) => void;
  setRetestResult: (id: string, sampleId: string, attrCode: string, result: TestResult) => void;
  /** ⑤ on a design-track (TOD) exception there is no sample: the auditor marks
   *  each design check that failed again, against the fix evidence. The first
   *  mark starts the round. */
  setRetestCheck: (id: string, pointId: string, result: TestResult) => void;
  /** ⑤ TOD — Ira reads just the retest's checks against the fix evidence. */
  runRetestIra: (id: string) => void;
  recordRetest: (id: string, rationale?: string) => void;
  signOffException: (id: string) => void;
  reopenException: (id: string, reason: string) => void;
  updateRemediation: (id: string, patch: Partial<Deficiency['remediation']>) => void;
  addRemediationEvidence: (id: string, fileName: string) => void;
  /** The owner disagrees with a severity input, on the record. It routes to the
   *  auditor and changes nothing by itself — see SeverityChallenge. */
  raiseChallenge: (id: string, input: ChallengedInput, reasoning: string, fileName?: string) => void;
  /** The auditor answers it. A reason is required whichever way it goes; accepting
   *  does not move the number — the auditor still edits the input themselves, and
   *  the engine re-grades off that edit like any other. */
  respondToChallenge: (id: string, challengeId: string, decision: 'Accepted' | 'Declined', reason: string) => void;
  /** Blocked testing — a status on the control, not an exception. See UnableToTest. */
  markUnableToTest: (controlId: string, track: 'design' | 'operating', reason: string, needed: string) => void;
  resolveUnableToTest: (controlId: string) => void;
  escalateUnableToTest: (controlId: string) => void;
  // create control + engagement-level sign-off
  addControl: (draft: NewControlDraft) => string;
  /** The lead's proposal, before anyone has signed it. Refused once signed —
   *  a change from there is a revision, not an edit. */
  proposeSampling: (patch: Partial<Pick<SamplingMethodology, 'sizes' | 'method' | 'spread' | 'roundBasis'>>) => void;
  /** The reviewer's signature. What makes the methodology agreed. */
  signSampling: () => void;
  /** A change to an agreed methodology — mints the next version, with a reason. */
  reviseSampling: (patch: Partial<Pick<SamplingMethodology, 'sizes' | 'method' | 'spread' | 'roundBasis'>>, reason: string) => void;
  /** Sign off the OPEN audit. There is no engagement-level ICFR sign-off — the
   *  testing lives inside an audit, so the conclusion does too. */
  signOffAudit: (step: 'preparer' | 'reviewer') => void;
  // unlock a concluded control — auditor only, reason required, logged in the trail
  reopenControl: (controlId: string, reason: string) => void;
  // per-working-paper sign-off — auditor signs a concluded control's paper, reviewer countersigns
  signOffControlWp: (controlId: string, step: 'preparer' | 'reviewer') => void;
  // the reviewer's other verb — send the concluded paper back with a note instead of countersigning
  returnControl: (controlId: string, reason: string) => void;
  // review notes — the formal channel: reviewer raises, auditor resolves, reviewer verifies/reopens
  raiseReviewNote: (controlId: string, text: string) => void;
  resolveReviewNote: (noteId: string, response: string) => void;
  verifyReviewNote: (noteId: string) => void;
  reopenReviewNote: (noteId: string) => void;
}

/** What Ira's first sizing reads from outside the engagement record (S9, A31/A32):
 *  the audit it is sized under — the open one, else the live cycle, the same rule
 *  a draw follows — the round that dated the control's items, and the trial
 *  balance. The sizing form builds the same thing to show its working. */
function exposureContext(eng: IcfrEngagement, openAuditId: string | null, c: Control): ExposureContext {
  const entities = entitiesFor(eng.id);
  return {
    audit: workingAudit(eng, openAuditId),
    home: sampleHome(eng, a => auditCovers(a, c, eng.id)),
    captions: captionsFor(eng.id),
    normalise: normaliseProcess,
    entityName: id => entities.find(e => e.id === id)?.name ?? id,
  };
}
/** The trail's line for that first sizing — Ira's, with the reasons it tagged, so
 *  the history says where the starting figures came from before anyone moved them. */
function iraSizingEvent(d: Deficiency, role: Role): ExecutionEvent {
  const why = d.iraSuggested ?? {};
  return {
    id: uid('ex'), controlId: d.controlId, track: d.track, kind: 'exception',
    verb: `suggested the sizing for ${d.id} — ${d.likelihood.toLowerCase()}, exposure ${formatINR(d.magnitude)}, ${d.compensatingControlId ? `compensating control ${d.compensatingControlId}` : 'no compensating control'}`,
    rationale: [why.likelihood && `Likelihood: ${why.likelihood}.`, why.magnitude && `Exposure: ${why.magnitude}.`, why.compensatingControlId && `Compensating control: ${why.compensatingControlId}.`].filter(Boolean).join(' '),
    by: 'Ira', role, at: 'just now',
  };
}

const Ctx = createContext<IcfrCtx | null>(null);

export function useIcfr(): IcfrCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useIcfr must be used within IcfrProvider');
  return c;
}

export function IcfrProvider({ children, initialRole = 'auditor', seedMeta }: { children: ReactNode; initialRole?: Role; seedMeta?: SeedMeta }) {
  // Navigation refused for a reason has to SAY the reason — a click that quietly
  // does nothing reads as a broken page. The app's toast provider sits above this
  // one, so the store can speak without owning a notice surface of its own.
  const { addToast } = useToast();
  const [eng, setEng] = useState<IcfrEngagement>(() => seedIcfrEngagement(seedMeta));
  const [role, setRole] = useState<Role>(initialRole);
  const [tab, setTabState] = useState<SoxTab>('overview');
  const [view, setView] = useState<View>('overview');
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null);
  const [racmEditor, setRacmEditor] = useState<RacmEditorMeta | null>(null);
  // Where the open drill-in (dossier / racm-editor) should return to — e.g. the
  // RACM matrix ('racm-list'), not the tab root card.
  const [returnView, setReturnView] = useState<View | null>(null);
  // Which business process's RACM the matrix view shows — one RACM per process.
  const [racmProcess, setRacmProcess] = useState<string | null>(null);
  const [racmDocs, setRacmDocs] = useState<(EvidenceFile & { process?: string; source?: 'racm' | 'sop'; url?: string })[]>([]);
  // Owner mode is a person-lane, not a role-lane: "mine" = this named owner's
  // controls, tasks and exceptions. The picker in the top bar switches personas.
  // Start on an owner who actually has something to do. A hard-coded name lands
  // the owner's hat on an empty queue whenever the seeded exceptions belong to
  // someone else, which reads as "nothing is assigned to me" rather than "you are
  // looking at the wrong person".
  const [meOwner, setMeOwner] = useState(() => {
    const live = eng.deficiencies.find(d => d.status !== 'Closed');
    const owner = live && eng.controls.find(c => c.id === live.controlId)?.owner;
    return owner ?? eng.controls[0]?.owner ?? 'M. Nair';
  });

  // Person-based identity: each hat acts as the engagement's named person, not a
  // role label — so self-review guards compare people, and the trail reads real names.
  const me = role === 'auditor' ? eng.preparer : role === 'reviewer' ? eng.reviewer : meOwner;


  // Every control mutation flows through here — a concluded control (or a
  // countersigned engagement) is frozen; reopenControl below is the only way back in.
  const patchControl = useCallback((controlId: string, fn: (c: Control) => Control) => {
    setEng(prev => {
      const target = prev.controls.find(c => c.id === controlId);
      if (!target || isEngagementLocked(prev) || isControlLocked(target)) return prev;
      return { ...prev, controls: prev.controls.map(c => (c.id === controlId ? fn(c) : c)) };
    });
  }, []);

  // Append one execution to the shared trail. `make` runs against fresh post-action
  // state (this setEng is queued after the action's), so it can read final results.
  const pushExec = useCallback((make: (prev: IcfrEngagement) => ExecDraft | null) => {
    setEng(prev => {
      const draft = make(prev);
      if (!draft) return prev;
      const event: ExecutionEvent = { id: uid('ex'), by: me, role, at: 'just now', ...draft };
      return { ...prev, executions: [event, ...prev.executions] };
    });
  }, [me, role]);

  // Declared up here with the rest of the navigation state — openControl reads
  // it to decide whether a focused open needs to enter an audit first, and the
  // guard below reads it for the open audit's round.
  const [openAuditId, setOpenAuditId] = useState<string | null>(null);

  // ── locked until approved (S6, A36) ───────────────────────────────────────────
  // Population, Sample and TOE wait on the reviewer's approval of TOD. The control
  // page renders those steps locked; this is the store backing it, so a stale
  // button or a deep link cannot start work the page says is not open yet. It
  // gates the actions that START the work — extracting and locking a population,
  // drawing a sample, recording TOE results and concluding — and leaves the ways
  // back out (withdraw, drop a file, redraw, clear a conclusion) alone.
  //
  // Year-end controls (A29) are held by the same guard: an Annual control in an
  // interim or roll-forward audit has its Population, Sample and TOE pending
  // until the year closes (yearEndPending). Same steps, same actions, so one
  // guard — every action S6 gated refuses for either reason.
  const awaitingDesignApproval = useCallback((controlId: string) => {
    const c = eng.controls.find(x => x.id === controlId);
    return !c || !designApproved(c) || !!yearEndPending(c, eng.audits.find(a => a.id === openAuditId));
  }, [eng.controls, eng.audits, openAuditId]);

  // Selecting a tab resets to that tab's root view; both personas share the same tabs.
  const setTab = useCallback((t: SoxTab) => {
    setTabState(t);
    setView(TAB_ROOT[t]);
    setSelectedControlId(null);
    setReturnView(null);
  }, []);

  const changeRole = useCallback((r: Role) => {
    setRole(r);
    setTabState('overview');
    setView('overview');
    setSelectedControlId(null);
  }, []);

  // Open one business process's RACM as the full risks & controls matrix.
  const openRacmMatrix = useCallback((process: string) => {
    setRacmProcess(process); setTabState('racm'); setView('racm-list');
  }, []);

  // Open a RACM in the full Excel editor (the Process-Hub experience), kept under the RACM tab.
  const openRacmEditor = useCallback((meta: RacmEditorMeta) => {
    setReturnView(RETURNABLE.includes(view) ? view : null);
    setRacmEditor(meta); setTabState('racm'); setView('racm-editor');
  }, [view]);

  const [focusDefId, setFocusDefId] = useState<string | null>(null);
  const clearFocusDef = useCallback(() => setFocusDefId(null), []);
  const [focusStep, setFocusStep] = useState<FocusStep | null>(null);
  const clearFocusStep = useCallback(() => setFocusStep(null), []);
  const openControl = useCallback((id: string, focus?: FocusStep) => {
    // The owner's lane is their own controls, and a link is not an exception to
    // that. Their lists already filter, so this only bites on a route that skips
    // them — a task row, a notification, a deep link — which is exactly where a
    // silent open would be worst.
    if (role === 'risk-owner') {
      const c = eng.controls.find(x => x.id === id);
      if (c && !isOwnerOf(c, meOwner)) {
        addToast({
          type: 'info', title: 'This control is not yours to open',
          message: `${c.wpRef} sits with ${ownersOf(c).controlOwner}. Your Control Library lists the ones you answer for.`,
        });
        setTabState('controls'); setView('register'); setSelectedControlId(null); setReturnView(null);
        return;
      }
    }
    setReturnView(RETURNABLE.includes(view) ? view : null);
    setFocusStep(focus ?? null);
    // A focus names a STEP, and the steps only exist on the audit-level control
    // page — outside an audit the same view renders the library detail, which
    // has no Population to land on. So a focused open resolves the audit the
    // control is tested under and goes in through it, the same way
    // openDeficiency does for a finding.
    if (focus && !openAuditId) {
      const proc = eng.controls.find(c => c.id === id)?.process;
      const owning = eng.audits.find(a => a.controlIds?.length ? a.controlIds.includes(id) : (proc ? a.scopeNames.includes(proc) : false));
      if (owning) { setOpenAuditId(owning.id); setTabState('overview'); }
    }
    setSelectedControlId(id); setView('dossier');
  }, [view, openAuditId, eng.controls, eng.audits, role, meOwner, addToast]);
  // A counted click on the Overview lands on the register showing exactly the
  // counted set — the register consumes the preset once, then owns its filters.
  const [registerPreset, setRegisterPreset] = useState<{ view?: string; process?: string } | null>(null);
  const openRegister = useCallback((preset: { view?: string; process?: string }) => {
    setRegisterPreset(preset);
    setTabState('controls');
    setView('register');
    setSelectedControlId(null);
    setReturnView(null);
  }, []);
  const clearRegisterPreset = useCallback(() => setRegisterPreset(null), []);
  // The Overview's "Upload RACM" is a door, not a second flow: it lands on the
  // RACM tab with the same chooser open that the tab's own button raises. The
  // chooser asks for entity and process, which the Overview has no business
  // asking, and duplicating it would leave two upload paths to keep in step.
  const [racmCreateOpen, setRacmCreateOpen] = useState(false);
  const openRacmCreate = useCallback(() => {
    setRacmCreateOpen(true);
    setTabState('racm');
    setView('racm');
    setSelectedControlId(null);
    setReturnView(null);
  }, []);
  const clearRacmCreate = useCallback(() => setRacmCreateOpen(false), []);
  // Drill-ins return to where they were opened from (e.g. the RACM matrix),
  // falling back to the active tab's root so the tab bar stays in context.
  // A stale returnView can point at the page we're already on (Exceptions →
  // dossier → its "Deficiencies" link lands back here without consuming it) —
  // going "back" to the same view would be a dead click, so fall through.
  const back = useCallback(() => {
    setView(returnView && returnView !== view ? returnView : TAB_ROOT[tab]);
    setSelectedControlId(null);
    setReturnView(null);
  }, [tab, returnView, view]);

  // ── design track ──────────────────────────────────────────────────────────────
  // D1 role gates: testing is the auditor's pen alone. The owner contributes
  // evidence — documents and attestations — and the reviewer only reads & signs.
  const setDocStatus = useCallback<IcfrCtx['setDocStatus']>((controlId, docId, status) => {
    if (role === 'reviewer') return;   // owner uploads, auditor can attach on their behalf
    patchControl(controlId, c => ({ ...c, design: { ...c.design, documents: c.design.documents.map(d => d.id === docId ? { ...d, status, uploadedBy: status === 'Received' ? 'Risk Owner' : d.uploadedBy, at: status === 'Received' ? 'just now' : d.at } : d) } }));
    if (status === 'Received') pushExec(prev => { const d = prev.controls.find(c => c.id === controlId)?.design.documents.find(dd => dd.id === docId); return d ? { controlId, track: 'design', kind: 'receive-doc', verb: 'marked received', target: d.kind } : null; });
  }, [patchControl, pushExec, role]);

  const setDesignPoint = useCallback<IcfrCtx['setDesignPoint']>((controlId, pointId, result) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({ ...c, design: { ...c.design, points: c.design.points.map(p => p.id === pointId ? { ...p, result } : p) } }));
  }, [patchControl, role]);

  // An ineffective track never fizzles — it raises its exception automatically.
  // Runs against post-action state (queued after the conclude/override setEng),
  // no-ops unless the track actually reads Ineffective, and dedupes against an
  // existing open exception for the same control + track. Severity starts from
  // Ira's first sizing (suggestSizing, S9 A31) — tagged, and the auditor's to
  // change on the exception card.
  /** `onSecondRound` — the failure IS the finding, so the deficiency is raised
   *  when it happens rather than waiting for the conclusion (user, 12 Aug). The
   *  first round's failure never lands here: it is allowed to be the draw's
   *  fault, and the auditor gets one corrected redraw to show that it was. */
  const raiseDeficiencyIfIneffective = useCallback((controlId: string, track: 'design' | 'operating', onSecondRound = false) => {
    setEng(prev => {
      const c = prev.controls.find(x => x.id === controlId);
      if (!c) return prev;
      if (onSecondRound
        // Only in the LAST round. A first-round failure passes through
        // untouched — the auditor still has one corrected redraw to show the
        // draw was at fault rather than the control.
        ? toeRoundNo(c) < TOE_MAX_ROUNDS || !c.operating.steps.some(s => stepResult(s) === 'Fail')
        : trackResult(track === 'design' ? c.design : c.operating) !== 'Ineffective') return prev;
      if (prev.deficiencies.some(d => d.controlId === controlId && d.track === track && d.status !== 'Closed')) return prev;
      const failed = track === 'design'
        ? c.design.points.filter(p => (p.override?.result ?? p.result) === 'Fail').map(p => p.text)
        : c.operating.steps.filter(s => (s.override?.result ?? s.result) === 'Fail').map(s => s.code);
      const next = Math.max(0, ...prev.deficiencies.map(d => parseInt(d.id.replace(/\D/g, ''), 10) || 0)) + 1;
      // Which sampled items it was found in — the evidence behind the exception,
      // and the thing the root cause has to explain rather than restate.
      const failedSamples = track === 'operating'
        ? Array.from(new Set(c.operating.steps.flatMap(s =>
            Object.entries(s.sampleResults ?? {}).filter(([, r]) => r === 'Fail')
              .map(([sid]) => c.operating.sampling?.samples.find(x => x.id === sid)?.ref ?? sid))))
        : [];
      const def: Deficiency = {
        id: `DEF-${String(next).padStart(3, '0')}`,
        controlId, track,
        // A second-round failure is described as what it is — the control failed
        // again, on a sample drawn to answer the first failure — because reading
        // "concluded ineffective" on a track nobody has concluded yet would be
        // the record saying something that did not happen.
        description: (() => {
          const what = failed.length
            ? ` — failed: ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? ` +${failed.length - 3} more` : ''}.`
            : '.';
          if (onSecondRound) return `TOE failed again on ${c.wpRef}, on the redrawn sample${what}`;
          return `${track === 'design' ? 'TOD' : 'TOE'} concluded ineffective on ${c.wpRef}${what}`;
        })(),
        // Ira drafts it from what failed (17 Sep dev call), but a draft is not a
        // root cause: step 1 stays open until the auditor edits it or takes it
        // (rootCauseReady) — the whole exception turns on this sentence.
        rootCause: '',
        failedSamples,
        likelihood: 'Reasonably possible',
        magnitude: 0,
        mwIndicators: [],
        compensatingControlId: undefined,
        aggregationGroup: c.process,
        // The exception starts with the auditor whatever auto-routing says. It
        // cannot go to the owner before it has a root cause and a grade — that is
        // the point of steps 1 and 2, and the owner has nothing to plan against
        // until they exist.
        //
        // Deliberately the CONTROL owner, not the process owner: evidence is
        // asked of whoever runs the process, but a broken control is answered
        // for by whoever is accountable for it. Only the first of those two
        // moved when controls gained a second name.
        remediation: { action: '', date: null, owner: c.owner, status: 'Open' },
        status: 'Identified',
      };
      // The design twin of failedSamples: which checks failed, stamped now so a
      // TOD retest re-checks exactly these however the TOD moves afterwards.
      if (track === 'design') {
        const failedChecks = c.design.points.filter(p => (p.override?.result ?? p.result) === 'Fail').map(p => ({ pointId: p.id, text: p.text }));
        if (failedChecks.length) def.failedChecks = failedChecks;
      }
      // Ira's first sizing (S9, A31): likelihood, exposure and compensating
      // control filled in from the evidence, each tagged with why. No accept
      // click — the grade computes off them now, and the auditor changes any.
      const sized = suggestSizing(def, prev, exposureContext(prev, openAuditId, c), onSecondRound);
      def.likelihood = sized.likelihood;
      def.magnitude = sized.magnitude;
      def.compensatingControlId = sized.compensatingControlId;
      def.iraSuggested = sized.iraSuggested;
      const drafted = suggestRootCause(c, track, failedSamples, onSecondRound);
      if (drafted) {
        def.rootCause = drafted.text;
        def.iraSuggested = { ...def.iraSuggested, rootCause: drafted.reason };
      }
      const event: ExecutionEvent = {
        id: uid('ex'), controlId, track, kind: 'exception',
        verb: `raised ${def.id} — severity to assess${prev.rules.autoRoute ? ` · auto-routed to ${c.owner}` : ''}`, by: me, role, at: 'just now',
      };
      return { ...prev, deficiencies: [def, ...prev.deficiencies], executions: [iraSizingEvent(def, role), event, ...prev.executions] };
    });
  }, [me, role, openAuditId]);

  const concludeDesign = useCallback<IcfrCtx['concludeDesign']>((controlId, conclusion, rationale) => {
    if (role !== 'auditor') return;
    // re-concluding clears a reviewer's return note — the rework happened
    // Clearing the conclusion clears its rationale too: words explaining a
    // conclusion that no longer exists would outlive the thing they explain.
    // Every conclusion goes to the reviewer (S6, A36): prepared by whoever
    // concluded it, approval pending. Re-concluding starts that over with the new
    // preparer and retires the reviewer's send-back note; clearing it clears both.
    patchControl(controlId, c => ({ ...c, reviewReturn: conclusion === 'Not tested' ? c.reviewReturn : undefined, design: { ...c.design, conclusion, rationale: conclusion === 'Not tested' ? undefined : (rationale?.trim() || c.design.rationale), testedBy: me, testedAt: 'just now',
      approval: conclusion === 'Not tested' ? undefined : { preparedBy: { by: me, at: 'just now' } },
      designReturn: conclusion === 'Not tested' ? c.design.designReturn : undefined } }));
    if (conclusion !== 'Not tested') pushExec(() => ({ controlId, track: 'design', kind: 'conclude', verb: `concluded design ${conclusion.toLowerCase()}`, result: conclusion }));
    if (conclusion === 'Ineffective') raiseDeficiencyIfIneffective(controlId, 'design');
  }, [patchControl, me, role, pushExec, raiseDeficiencyIfIneffective]);

  const overrideDesign = useCallback<IcfrCtx['overrideDesign']>((controlId, override) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => {
      const design = { ...c.design, override: override ?? undefined };
      const next = trackResult(design);
      // An override is a conclusion too, so it goes back to the reviewer like one.
      // Taking an override off only does when it moves the verdict — undoing the
      // override the conclude footer files alongside every agreeing conclusion
      // must not reset an approval nothing changed under.
      const approval = next === 'Not tested' ? undefined
        : override || next !== trackResult(c.design) ? { preparedBy: { by: me, at: 'just now' } }
        : c.design.approval;
      return { ...c, design: { ...design, approval, designReturn: override ? undefined : design.designReturn } };
    });
    if (override) pushExec(() => ({ controlId, track: 'design', kind: 'override', verb: 'overrode the design conclusion', result: override.result === 'Effective' ? 'Effective' : 'Ineffective' }));
    if (override?.result === 'Ineffective') raiseDeficiencyIfIneffective(controlId, 'design');
  }, [patchControl, me, role, pushExec, raiseDeficiencyIfIneffective]);

  // ── design sign-off after TOD (S6, A36) ─────────────────────────────────────
  // The reviewer's read of a concluded TOD, before any data is pulled against it.
  // Deliberately NOT routed through patchControl: a TOD concluded ineffective
  // concludes the whole control, and patchControl refuses a concluded control —
  // which would leave the reviewer unable to approve or return the one design
  // that most needs reading. signOffControlWp and returnControl write around it
  // for the same reason, and these refuse what those two refuse: a sealed
  // engagement, and a paper already countersigned.
  const approveDesign = useCallback<IcfrCtx['approveDesign']>((controlId) => {
    if (role !== 'reviewer') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const target = prev.controls.find(c => c.id === controlId);
      if (!target || target.wpSignoff?.reviewer || trackResult(target.design) === 'Not tested') return prev;
      const approval = target.design.approval;
      // Once is enough, and four-eyes: whoever concluded TOD never approves it.
      if (approval?.approvedBy) return prev;
      // A conclusion stamped before approvals existed names its preparer the way
      // the rest of the paper does — whoever tested it.
      const preparedBy = approval?.preparedBy ?? { by: target.design.testedBy ?? prev.preparer, at: target.design.testedAt ?? 'just now' };
      if (samePerson(preparedBy, me)) return prev;
      const event: ExecutionEvent = { id: uid('ex'), controlId, track: 'design', kind: 'design-approval', verb: 'approved TOD', result: trackResult(target.design), by: me, role, at: 'just now' };
      return {
        ...prev,
        controls: prev.controls.map(c => c.id === controlId ? { ...c, design: { ...c.design, approval: { preparedBy, approvedBy: { by: me, at: 'just now' } } } } : c),
        executions: [event, ...prev.executions],
      };
    });
  }, [me, role]);

  // The other answer: TOD goes back to the auditor with a note. The design
  // conclusion clears the way a return clears it (the evidence, the checks and
  // the walkthrough all stay), and so does any signature on the paper — a paper
  // whose TOD was sent back is no longer the paper anybody signed.
  const returnDesign = useCallback<IcfrCtx['returnDesign']>((controlId, note) => {
    if (role !== 'reviewer') return;
    const why = note.trim();
    if (!why) return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const target = prev.controls.find(c => c.id === controlId);
      if (!target || target.wpSignoff?.reviewer || trackResult(target.design) === 'Not tested') return prev;
      // An approved TOD has had work built on it; the way back from there is the
      // control-level return at sign-off, not quietly re-locking the steps.
      if (target.design.approval?.approvedBy) return prev;
      const event: ExecutionEvent = { id: uid('ex'), controlId, track: 'design', kind: 'design-approval', verb: 'returned TOD to the auditor', target: short(why, 80), rationale: why, by: me, role, at: 'just now' };
      return {
        ...prev,
        controls: prev.controls.map(c => c.id === controlId ? {
          ...c,
          wpSignoff: undefined,
          design: { ...c.design, conclusion: 'Not tested', override: undefined, testedBy: null, testedAt: null, approval: undefined, designReturn: { note: why, by: me, at: 'just now' } },
        } : c),
        executions: [event, ...prev.executions],
      };
    });
  }, [me, role]);

  const addDesignDoc = useCallback<IcfrCtx['addDesignDoc']>((controlId, kind, custom) => {
    if (role !== 'auditor') return;
    const doc: DesignDoc = custom
      ? { id: uid('dd'), kind: 'Custom', name: custom.name, description: custom.description, status: 'Missing' }
      : { id: uid('dd'), kind, name: `${kind} — to provide`, status: 'Missing' };
    patchControl(controlId, c => ({ ...c, design: { ...c.design, documents: [...c.design.documents, doc] } }));
    // Logged only if it landed — a concluded control refuses the patch.
    pushExec(prev => (prev.controls.find(c => c.id === controlId)?.design.documents.some(d => d.id === doc.id)
      ? { controlId, track: 'design', kind: 'add-element', verb: 'added the design element', target: doc.kind === 'Custom' ? doc.name : doc.kind }
      : null));
  }, [patchControl, pushExec, role]);
  // A file came or went on a design element (S6, A17). Ira's last read and every
  // override on the checks were made against the evidence as it stood, so both
  // are flagged as older than it. Neither is cleared — the read still happened,
  // and the override is still the auditor's recorded judgement.
  const evidenceMoved = (design: DesignTrack): DesignTrack => ({
    ...design,
    ira: design.ira ? { ...design.ira, evidenceChanged: true } : design.ira,
    points: design.points.map(p => (p.override ? { ...p, overrideEvidenceChanged: true } : p)),
  });

  // Attach evidence files to a design element — the element becomes Evidenced,
  // which is what the evidence-first TOD completeness gate counts. (Hand-merged
  // from main's go-live commit for the evidence-first dossier.)
  //
  // The files are the ones picked off this machine (S6, C7): their own names and
  // kinds, stamped with who uploaded them and when. The element keeps its own
  // name — it used to be renamed after the file, which turned a custom element's
  // title into a filename.
  const attachDesignEvidence = useCallback<IcfrCtx['attachDesignEvidence']>((controlId, docId, files) => {
    if (role === 'reviewer' || files.length === 0) return;
    const at = fmtDateTime();
    const added: EvidenceFile[] = files.map(f => ({ id: uid('f'), name: f.name, kind: f.kind, url: f.url, uploadedBy: me, uploadedAt: at }));
    let label = '';
    patchControl(controlId, c => {
      const doc = c.design.documents.find(d => d.id === docId);
      if (!doc) return c;
      label = doc.kind === 'Custom' ? doc.name : doc.kind;
      return { ...c, design: evidenceMoved({ ...c.design, documents: c.design.documents.map(d => d.id === docId
        ? { ...d, status: 'Received' as DocStatus, uploadedBy: me, at, files: [...designFilesOf(d), ...added] }
        : d) }) };
    });
    pushExec(() => (label ? { controlId, track: 'design', kind: 'receive-doc', verb: `attached ${added.map(f => f.name).join(', ')}`, target: label } : null));
  }, [patchControl, me, role, pushExec]);

  // One file off a design element (S6, A21). The auditor can take any file off;
  // the control owner only what they put there themselves. The last file going
  // takes the element back to Missing — nothing on file is not evidenced, however
  // it read before. Names are caught inside the patch, before they are gone.
  const removeDesignFile = useCallback<IcfrCtx['removeDesignFile']>((controlId, docId, fileId) => {
    if (role === 'reviewer') return;
    let removed: { file: string; element: string } | null = null;
    patchControl(controlId, c => {
      const doc = c.design.documents.find(d => d.id === docId);
      const files = doc ? designFilesOf(doc) : [];
      const file = files.find(f => f.id === fileId);
      if (!doc || !file || (role === 'risk-owner' && file.uploadedBy !== me)) return c;
      removed = { file: file.name, element: doc.kind === 'Custom' ? doc.name : doc.kind };
      if (file.url) URL.revokeObjectURL(file.url);
      const left = files.filter(f => f.id !== fileId);
      return { ...c, design: evidenceMoved({ ...c.design, documents: c.design.documents.map(d => d.id !== docId ? d
        : left.length ? { ...d, files: left }
        : { ...d, status: 'Missing' as DocStatus, files: undefined, uploadedBy: undefined, at: undefined }) }) };
    });
    pushExec(() => (removed ? { controlId, track: 'design', kind: 'remove-file', verb: `removed ${removed.file} from ${removed.element}` } : null));
  }, [patchControl, me, role, pushExec]);
  const removeDesignDoc = useCallback<IcfrCtx['removeDesignDoc']>((controlId, docId) => {
    if (role !== 'auditor') return;
    // The element is gone by the time the trail entry is written, so its label is
    // read on the way out.
    let removed: string | undefined;
    patchControl(controlId, c => {
      const gone = c.design.documents.find(d => d.id === docId);
      if (gone) removed = gone.kind === 'Custom' ? gone.name : gone.kind;
      return { ...c, design: { ...c.design, documents: c.design.documents.filter(d => d.id !== docId) } };
    });
    pushExec(() => (removed ? { controlId, track: 'design', kind: 'remove-element', verb: 'removed the design element', target: removed } : null));
  }, [patchControl, pushExec, role]);

  // Waive a required element instead of chasing a file that doesn't exist. The
  // reason is the record — three real situations, none of them a gap — so this is
  // a judgement the paper prints, not a status quietly flipped to Received.
  const waiveDesignDoc = useCallback<IcfrCtx['waiveDesignDoc']>((controlId, docId, reason, note) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({ ...c, design: { ...c.design, documents: c.design.documents.map(d => d.id === docId
      ? { ...d, waiver: { reason, note, by: me, at: 'just now' } }
      : d) } }));
    pushExec(prev => { const d = prev.controls.find(c => c.id === controlId)?.design.documents.find(dd => dd.id === docId); return d ? { controlId, track: 'design', kind: 'waive-doc', verb: `waived — ${reason.toLowerCase()}`, target: d.kind } : null; });
  }, [patchControl, me, pushExec, role]);
  const clearDesignWaiver = useCallback<IcfrCtx['clearDesignWaiver']>((controlId, docId) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({ ...c, design: { ...c.design, documents: c.design.documents.map(d => d.id === docId ? { ...d, waiver: undefined } : d) } }));
  }, [patchControl, role]);

  // The control's identity, not its results. `patchControl` refuses on a concluded
  // control, which is right — reclassifying a row under a signed conclusion would
  // rewrite what was signed — so the UI renders these disabled with the reopen
  // affordance rather than letting the click land nowhere.
  const updateControlMeta = useCallback<IcfrCtx['updateControlMeta']>((controlId, patch) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({ ...c, ...patch }));
  }, [patchControl, role]);

  /**
   * Key / non-key, set while an audit is being scoped.
   *
   * Deliberately NOT routed through `patchControl`, whose concluded-control
   * guard exists to stop a signed working paper being rewritten. Scoping runs
   * before any of that: a new audit is created with nothing tested, and a
   * roll-forward carries the RACM and its controls but starts testing from zero
   * — so a control cannot be concluded at the moment this is asked. The guard
   * would only ever bite on a seeded demo engagement that already has a cycle
   * in flight, where it would silently swallow the click.
   *
   * The control page's own key switch keeps `updateControlMeta`, and with it
   * the guard: there, the control genuinely can be concluded already.
   */
  const setControlKey = useCallback<IcfrCtx['setControlKey']>((controlId, isKey) => {
    if (role !== 'auditor') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      return { ...prev, controls: prev.controls.map(c => (c.id === controlId ? { ...c, isKey } : c)) };
    });
  }, [role]);

  // The design judgements the paper states. Stamped with who recorded them, so a
  // reader can see the questions were actually considered rather than defaulted.
  const setDesignJudgements = useCallback<IcfrCtx['setDesignJudgements']>((controlId, patch) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({
      ...c,
      design: { ...c.design, judgements: { ...c.design.judgements, ...patch, by: me, at: 'just now' } },
    }));
  }, [patchControl, me, role]);

  // ── Walkthrough — the design tested on one transaction ────────────────────────
  // The transaction comes from the same generator the real sample uses, so the
  // reference the auditor walks is one they could actually pull. The attributes
  // are NOT copied here: the walkthrough records results against the operating
  // track's attribute ids, so adding an attribute later leaves the walkthrough
  // honestly incomplete rather than silently short.
  const startWalkthrough = useCallback<IcfrCtx['startWalkthrough']>((controlId) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => c.design.walkthrough ? c : ({
      ...c,
      design: {
        ...c.design,
        walkthrough: {
          sampleRef: sampleRefs(c.process, 1)[0] ?? '#1000',
          date: 'just now',
          tester: me,
          attendees: [],
          attributeResults: {},
          startedBy: me,
          startedAt: 'just now',
        },
      },
    }));
    pushExec(() => ({ controlId, track: 'design', kind: 'walkthrough', verb: 'started the walkthrough — design tested on one transaction' }));
  }, [patchControl, me, pushExec, role]);
  const setWalkthroughAttribute = useCallback<IcfrCtx['setWalkthroughAttribute']>((controlId, stepId, result) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => c.design.walkthrough
      ? { ...c, design: { ...c.design, walkthrough: { ...c.design.walkthrough, attributeResults: { ...c.design.walkthrough.attributeResults, [stepId]: result } } } }
      : c);
    pushExec(prev => {
      const s = prev.controls.find(c => c.id === controlId)?.operating.steps.find(x => x.id === stepId);
      return s ? { controlId, track: 'design', kind: 'walkthrough', verb: 'recorded the walkthrough result', target: s.code, result } : null;
    });
  }, [patchControl, pushExec, role]);
  const setWalkthroughMeta = useCallback<IcfrCtx['setWalkthroughMeta']>((controlId, patch) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => c.design.walkthrough
      ? { ...c, design: { ...c.design, walkthrough: { ...c.design.walkthrough, ...patch } } }
      : c);
  }, [patchControl, role]);
  const addDesignPoint = useCallback<IcfrCtx['addDesignPoint']>((controlId, text, stepId) => {
    if (role !== 'auditor') return;
    // The same check twice is one check (R2) — the second copy would be answered
    // twice and counted twice. Compared on its words, ignoring case and spacing.
    const same = (a: string) => a.trim().replace(/\s+/g, ' ').toLowerCase();
    // A refused duplicate adds nothing, so it logs nothing either.
    let added = false;
    patchControl(controlId, c => {
      if (c.design.points.some(p => same(p.text) === same(text))) return c;
      added = true;
      return { ...c, design: { ...c.design, points: [...c.design.points, { id: uid('dp'), text, stepId, result: 'Not tested', workflowId: uid('wf-tod'), workflowName: 'Design walkthrough check' } as DesignPoint] } };
    });
    pushExec(() => (added ? { controlId, track: 'design', kind: 'add-check', verb: 'added a design check', target: short(text) } : null));
  }, [patchControl, pushExec, role]);
  const removeDesignPoint = useCallback<IcfrCtx['removeDesignPoint']>((controlId, pointId) => {
    if (role !== 'auditor') return;
    // read before it goes, same as removeDesignDoc
    let removed: string | undefined;
    patchControl(controlId, c => {
      const gone = c.design.points.find(p => p.id === pointId);
      if (gone) removed = gone.text;
      return { ...c, design: { ...c.design, points: c.design.points.filter(p => p.id !== pointId) } };
    });
    pushExec(() => (removed ? { controlId, track: 'design', kind: 'remove-check', verb: 'removed a design check', target: short(removed) } : null));
  }, [patchControl, pushExec, role]);
  const validateDesignPoint = useCallback<IcfrCtx['validateDesignPoint']>((controlId, pointId) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({ ...c, design: { ...c.design, points: c.design.points.map(p => {
      if (p.id !== pointId) return p;
      const willFail = (p.override ? p.override.result : p.result) === 'Fail';
      // WHAT IT READ. The check's own proof first — that file was attached to
      // answer this very check — then the elements it cites. Named here so the
      // result can show the document beside the verdict instead of a verdict
      // with nothing to check it against (25 Sep).
      const proof = p.auditorProof?.file;
      const cited = c.design.documents
        .filter(d => p.evidencedBy?.includes(d.id))
        .flatMap(d => d.files ?? []);
      const read = proof ?? cited[0];
      return { ...p, result: willFail ? 'Fail' : 'Pass', override: undefined, workflowRunRef: 'run · validated · just now',
        validation: { qa: designCheckQA(p.text, willFail), at: 'just now', ...(read ? { fileName: read.name } : {}) } };
    }) } }));
    pushExec(prev => { const p = prev.controls.find(c => c.id === controlId)?.design.points.find(pt => pt.id === pointId); return p ? { controlId, track: 'design', kind: 'validate', verb: 'validated', target: short(p.text), result: p.result } : null; });
  }, [patchControl, pushExec, role]);
  // Recording or removing an override answers "evidence changed since override"
  // either way — the judgement now on the check is newer than the files.
  const overrideDesignPoint = useCallback<IcfrCtx['overrideDesignPoint']>((controlId, pointId, override) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({ ...c, design: { ...c.design, points: c.design.points.map(p => p.id === pointId ? { ...p, override: override ?? undefined, overrideEvidenceChanged: undefined } : p) } }));
  }, [patchControl, role]);

  // ── what evidences a check ────────────────────────────────────────────────────
  // A LINK to elements already on this control, never a second upload. The client
  // file lives on the element; the check points at it.
  const linkDesignPointEvidence = useCallback<IcfrCtx['linkDesignPointEvidence']>((controlId, pointId, docIds) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({ ...c, design: { ...c.design, points: c.design.points.map(p => p.id === pointId ? { ...p, evidencedBy: docIds.length ? docIds : undefined } : p) } }));
    pushExec(prev => {
      const ctrl = prev.controls.find(c => c.id === controlId);
      const p = ctrl?.design.points.find(pt => pt.id === pointId);
      if (!p) return null;
      const labels = ctrl!.design.documents.filter(d => docIds.includes(d.id)).map(d => (d.kind === 'Custom' ? d.name : d.kind));
      return { controlId, track: 'design', kind: 'validate', verb: labels.length ? `linked ${labels.join(', ')} as the evidence for a design check` : 'cleared the evidence links on a design check', target: short(p.text) };
    });
  }, [patchControl, pushExec, role]);

  // The auditor's own proof. One slot — replacing it replaces it.
  const setDesignPointProof = useCallback<IcfrCtx['setDesignPointProof']>((controlId, pointId, proof) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({ ...c, design: { ...c.design, points: c.design.points.map(p => p.id === pointId ? { ...p, auditorProof: proof ?? undefined } : p) } }));
    pushExec(prev => {
      const p = prev.controls.find(c => c.id === controlId)?.design.points.find(pt => pt.id === pointId);
      if (!p) return null;
      return { controlId, track: 'design', kind: 'validate', verb: proof ? `attached their own ${proof.kind.toLowerCase()} to a design check` : 'removed their proof from a design check', target: short(p.text) };
    });
  }, [patchControl, pushExec, role]);
  const requestDataByEmail = useCallback<IcfrCtx['requestDataByEmail']>((controlId, docIds, emails) => {
    if (role !== 'auditor') return;
    setEng(prev => {
      const ctrl = prev.controls.find(c => c.id === controlId);
      const kinds = ctrl ? ctrl.design.documents.filter(d => docIds.includes(d.id)).map(d => d.kind) : [];
      // The task lands on the process owner by name — they are who the email was
      // addressed to, and an address is not something you can look up a person by.
      const assignee = ctrl ? ownersOf(ctrl).processOwner : (emails[0] ?? 'Risk Owner');
      const task: HandoffTask = { id: uid('PBC'), type: 'pbc', controlId, title: `Provide design documents (${docIds.length})`, detail: `Requested from ${emails.join(', ')} — ${kinds.join(', ')}.`, assignee, assigneeRole: 'risk-owner', raisedBy: me, dueLabel: 'Due in 3d', overdue: false, status: 'open' };
      return { ...prev, controls: prev.controls.map(c => c.id === controlId ? { ...c, design: { ...c.design, documents: c.design.documents.map(d => docIds.includes(d.id) ? { ...d, status: 'Requested' as DocStatus } : d) } } : c), tasks: [...prev.tasks, task] };
    });
    pushExec(() => ({ controlId, track: 'design', kind: 'request-docs', verb: `requested ${docIds.length} design document${docIds.length === 1 ? '' : 's'}` }));
  }, [me, pushExec, role]);

  // ── evidence hierarchy + the design conclusion's two facts ────────────────────
  // Both roles tag evidence, because both produce it: the owner attests, the
  // auditor inspects and reperforms. Only a reviewer is out.
  const setPointEvidenceType = useCallback<IcfrCtx['setPointEvidenceType']>((controlId, pointId, type) => {
    if (role === 'reviewer') return;
    patchControl(controlId, c => ({ ...c, design: { ...c.design, points: c.design.points.map(p => p.id === pointId ? { ...p, evidenceType: type } : p) } }));
  }, [patchControl, role]);

  const setStepEvidenceType = useCallback<IcfrCtx['setStepEvidenceType']>((controlId, stepId, type) => {
    if (role === 'reviewer') return;
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, steps: c.operating.steps.map(s => s.id === stepId ? { ...s, evidenceType: type } : s) } }));
  }, [patchControl, role]);

  const setDesignBasis = useCallback<IcfrCtx['setDesignBasis']>((controlId, patch) => {
    if (role === 'reviewer') return;
    patchControl(controlId, c => ({ ...c, design: { ...c.design, ...patch } }));
    if (patch.basis) pushExec(() => ({ controlId, track: 'design', kind: 'conclude', verb: 'recorded what the design conclusion rests on', target: patch.basis }));
  }, [patchControl, pushExec, role]);

  // ── operating track ───────────────────────────────────────────────────────────
  // Inserting the population is the one step here the control's owner does as
  // often as the auditor: a population that isn't in a system to be queried can
  // only arrive as a file from the person who holds it. Judging it is still the
  // auditor's — see the gate below.
  const setPopulation = useCallback<IcfrCtx['setPopulation']>((controlId, population) => {
    if (role === 'reviewer' || awaitingDesignApproval(controlId)) return;
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, population } }));
    pushExec(() => ({ controlId, track: 'operating', kind: 'sample',
      verb: `extracted the population — ${population.count.toLocaleString()} instances${population.sourceCount ? ` from ${population.sourceCount.toLocaleString()} rows` : ''}`,
      target: population.criteria ?? population.source }));
  }, [patchControl, pushExec, role, awaitingDesignApproval]);

  // What "one instance" is comes out of the control's design, so it is the
  // auditor's call — and it is recorded rather than implied, because a row count
  // on its own never says whether it counted the right things.
  //
  // PARKED 30 Jul: the definition form was taken off step ① (user ask — the step
  // is now upload → select → extract). Nothing calls this; it is kept wired so
  // the form can come back without re-deriving the shape, and the seeds still
  // carry definitions that the working paper prints.
  const setPopulationDefinition = useCallback<IcfrCtx['setPopulationDefinition']>((controlId, def) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, definition: { ...def, by: me, at: 'just now' } } }));
    pushExec(() => ({ controlId, track: 'operating', kind: 'sample', verb: `defined the population — ${def.basis.toLowerCase()}, ${def.expectedCount} expected`, target: def.instance }));
  }, [patchControl, me, pushExec, role]);

  // A different extract is a different population. The sample drawn off the old
  // one, the results recorded against it and the gate that passed it all go with
  // it — keeping any of them would leave results keyed to items nobody can find.
  const clearPopulation = useCallback<IcfrCtx['clearPopulation']>((controlId) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({
      ...c,
      operating: {
        ...c.operating, population: undefined, sampling: undefined, extractionConfirmed: undefined, exceptions: undefined,
        // The per-item map goes AND the result it produced. `setSampleResult`
        // derives `result` from this map, so wiping the map alone left the
        // attribute reading Pass or Fail off items that no longer exist —
        // exactly the "results keyed to items nobody can find" the withdraw
        // confirmation warns about, happening anyway.
        //
        // Only steps that were tested against the sample are reset. An
        // attribute concluded some other way — an attestation, a workflow run —
        // was never drawn from this population and is not the population's to
        // undo. An override is left alone for the same reason: it is a recorded
        // human judgement with a rationale attached, and withdrawing an extract
        // is not grounds to delete somebody's reasoning.
        steps: c.operating.steps.map(s => (s.sampleResults ? { ...s, sampleResults: undefined, result: 'Not tested' } : s)),
      },
    }));
    pushExec(() => ({ controlId, track: 'operating', kind: 'sample', verb: 'withdrew the population — the sample drawn from it went with it' }));
  }, [patchControl, pushExec, role]);

  // PARKED — the population used to lock behind three tick boxes. Two of them
  // are computed now and the third became `provenance`; see PopulationChecks.
  const setPopulationCheck = useCallback<IcfrCtx['setPopulationCheck']>((controlId, key, value) => {
    if (role === 'reviewer') return;
    patchControl(controlId, c => (c.operating.population
      ? { ...c, operating: { ...c.operating, population: { ...c.operating.population, checks: { countMatches: false, dateRangeFull: false, productionSource: false, ...c.operating.population.checks, [key]: value } } } }
      : c));
  }, [patchControl, role]);

  // The facts the application cannot work out for itself — where the extract came
  // from, and why a computed check was argued with. Recorded, never attested.
  const setPopulationFacts = useCallback<IcfrCtx['setPopulationFacts']>((controlId, patch) => {
    if (role === 'reviewer') return;
    patchControl(controlId, c => (c.operating.population
      ? { ...c, operating: { ...c.operating, population: { ...c.operating.population, ...patch } } }
      : c));
  }, [patchControl, role]);

  // ── The files a population stands on ──────────────────────────────────────
  // A control rarely stands on one file (dev call, Aug 2026). The population
  // record keeps the totals so nothing downstream has to add anything up, and
  // they are RECOMPUTED from the list on every move rather than incremented —
  // an add, a drop and a re-filter then all land on the same arithmetic, and
  // the headline count cannot drift from the files underneath it.
  const rebuiltPopulation = (pop: Population, sources: PopulationSource[]): Population => {
    const t = sourceTotals(sources);
    return { ...pop, sources, count: t.count, sourceCount: t.rows, sourceFile: sources[0]?.file ?? pop.sourceFile };
  };
  // A report proved reliable on the files it had is not proved reliable on a
  // file that just arrived, and dropping a file that failed does not leave the
  // remaining ones concluded either. Both ways round, the verdict goes back to
  // the auditor — it is one verdict for all the files (the call: "सेंट्रलाइज्ड
  // कर दो ना"), so it can only be reached once they are all in.
  const reopenIpe = (ipe: IpeTest | undefined, checks: IpeTest['checks']): IpeTest | undefined =>
    ipe ? { ...ipe, checks, conclusion: 'Not tested', testedBy: null, testedAt: null } : ipe;

  const addPopulationSource = useCallback<IcfrCtx['addPopulationSource']>((controlId, src) => {
    if (role === 'reviewer' || awaitingDesignApproval(controlId)) return;
    patchControl(controlId, c => {
      const pop = c.operating.population;
      // Locked means locked: "सिर्फ खोल के आप देख सकते हो". A file added after
      // the lock would be a file every downstream conclusion never saw.
      if (!pop || pop.locked) return c;
      const existing = populationSources(c);
      // The same file twice is the same rows twice, and every count downstream
      // would double. Nothing is added rather than a second entry appearing.
      if (existing.some(s => s.file === src.file)) return c;
      // Assisting unless told otherwise. The usual reason to add a second file
      // is to join something onto the first — a vendor master onto a journal
      // table — and a file that starts sampling itself is a sample nobody asked
      // for, inside a population count nobody meant to inflate.
      const entry: PopulationSource = { role: 'assisting', ...src, id: uid('src') };
      const ipe = c.operating.ipe;
      return {
        ...c,
        operating: {
          ...c.operating,
          population: rebuiltPopulation(pop, [...existing, entry]),
          // The checks written before there was a list to belong to are stamped
          // with the first file as they go past — otherwise the moment a second
          // file arrives, four proven checks would read as belonging to nothing.
          ipe: reopenIpe(ipe, ipe ? [
            ...ipe.checks.map(k => ({ ...k, sourceId: k.sourceId ?? existing[0]?.id ?? LEGACY_SOURCE_ID })),
            ...ipeChecklist(src.file).map(k => ({ ...k, id: uid('ipe'), sourceId: entry.id })),
          ] : []),
        },
      };
    });
    pushExec(() => ({ controlId, track: 'operating', kind: 'sample',
      verb: `added ${src.file} to the population — ${src.count.toLocaleString()} instances from ${src.rows.toLocaleString()} rows`, target: src.criteria }));
  }, [patchControl, pushExec, role, awaitingDesignApproval]);

  // Dropping ONE file takes its proof and its items with it and touches nothing
  // else (user decision, Aug 2026). The other files were extracted, proven and
  // tested on their own; a wrong fourth file is no reason to make somebody redo
  // the first three. Dropping the last one is a withdrawal, and is handled as
  // one — a population of no files is not a population.
  const removePopulationSource = useCallback<IcfrCtx['removePopulationSource']>((controlId, sourceId) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => {
      const pop = c.operating.population;
      if (!pop || pop.locked) return c;
      const existing = populationSources(c);
      const sources = existing.filter(s => s.id !== sourceId);
      if (sources.length === existing.length) return c;
      if (!sources.length) {
        return { ...c, operating: { ...c.operating, population: undefined, ipe: undefined, sampling: undefined, extractionConfirmed: undefined, exceptions: undefined,
          steps: c.operating.steps.map(s => (s.sampleResults ? { ...s, sampleResults: undefined, result: 'Not tested' as TestResult } : s)) } };
      }
      // Everything drawn out of this one file, and only this one file.
      const gone = new Set(samplesFor(c, sourceId).map(s => s.id));
      const samp = c.operating.sampling;
      const samples = (samp?.samples ?? []).filter(s => !gone.has(s.id));
      // Results keyed to items nobody can find any more are the thing withdrawal
      // exists to prevent — so each attribute keeps the results for the items
      // that survived, and its own verdict is re-derived off what is left.
      const steps = c.operating.steps.map(st => {
        if (!st.sampleResults) return st;
        const kept = Object.fromEntries(Object.entries(st.sampleResults).filter(([id]) => !gone.has(id)));
        const vals = samples.map(it => kept[it.id] ?? 'Not tested');
        const derived: TestResult = vals.includes('Fail') ? 'Fail' : vals.length > 0 && vals.every(v => v === 'Pass') ? 'Pass' : 'Not tested';
        return { ...st, sampleResults: Object.keys(kept).length ? kept : undefined, result: st.override ? st.result : derived };
      });
      const ipe = c.operating.ipe;
      return {
        ...c,
        operating: {
          ...c.operating,
          population: rebuiltPopulation(pop, sources),
          ipe: reopenIpe(ipe, (ipe?.checks ?? []).filter(k => (k.sourceId ?? existing[0]?.id ?? LEGACY_SOURCE_ID) !== sourceId)),
          sampling: samp && samples.length ? { ...samp, size: samples.length, samples } : undefined,
          exceptions: (c.operating.exceptions ?? []).filter(x => !gone.has(x.sampleId)),
          steps,
        },
      };
    });
    pushExec(prev => {
      const file = prev.controls.find(c => c.id === controlId)?.operating.population?.sources?.find(s => s.id === sourceId)?.file;
      return { controlId, track: 'operating', kind: 'sample', verb: 'dropped a source file — its proof and the items drawn off it went with it', target: file };
    });
  }, [patchControl, pushExec, role]);

  // Population or assisting table. Turning a sampled file into an assisting one
  // takes its items with it — an assisting table is joined onto the population,
  // not tested, so items drawn from it were testing the wrong thing. Turning one
  // back into a population leaves it undrawn, which is what it is.
  // `next` rather than `role` — the hat the user is wearing is already called
  // that in this scope, and shadowing it here would silently disable the guard.
  const setSourceRole = useCallback<IcfrCtx['setSourceRole']>((controlId, sourceId, next) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => {
      const pop = c.operating.population;
      if (!pop || pop.locked) return c;
      const gone = next === 'assisting' ? new Set(samplesFor(c, sourceId).map(s => s.id)) : new Set<string>();
      const samp = c.operating.sampling;
      const samples = (samp?.samples ?? []).filter(s => !gone.has(s.id));
      const steps = gone.size === 0 ? c.operating.steps : c.operating.steps.map(st => {
        if (!st.sampleResults) return st;
        const kept = Object.fromEntries(Object.entries(st.sampleResults).filter(([id]) => !gone.has(id)));
        const vals = samples.map(it => kept[it.id] ?? 'Not tested');
        const derived: TestResult = vals.includes('Fail') ? 'Fail' : vals.length > 0 && vals.every(v => v === 'Pass') ? 'Pass' : 'Not tested';
        return { ...st, sampleResults: Object.keys(kept).length ? kept : undefined, result: st.override ? st.result : derived };
      });
      const sources = populationSources(c).map(s => (s.id === sourceId
        ? { ...s, role: next, ...(next === 'assisting' ? { draw: undefined, approvedSample: undefined } : {}) }
        : s));
      return {
        ...c,
        operating: {
          ...c.operating,
          population: rebuiltPopulation(pop, sources),
          sampling: samp && samples.length ? { ...samp, size: samples.length, samples } : gone.size ? undefined : samp,
          exceptions: (c.operating.exceptions ?? []).filter(x => !gone.has(x.sampleId)),
          steps,
        },
      };
    });
    pushExec(prev => {
      const file = prev.controls.find(c => c.id === controlId)?.operating.population?.sources?.find(s => s.id === sourceId)?.file;
      return { controlId, track: 'operating', kind: 'sample',
        verb: next === 'assisting' ? 'marked a source file an assisting table — it is proven but never sampled' : 'marked a source file part of the population',
        target: file };
    });
  }, [patchControl, pushExec, role]);

  // The audit a draw is made under, and the methodology the ENGAGEMENT agreed
  // (A28). Every action that adds items to a sample deals them by it.
  const drawAudit = workingAudit(eng, openAuditId);
  const drawMethod = samplingOf(eng);
  /** The companies a draw may deal to — the audit's (or engagement's) scope. */
  const drawScope = inScopeEntityNames(eng.id, drawAudit);
  // The round an undated item already on the control was drawn in (sampleHome),
  // so a deal evens out against the quarters those items really fall in.
  const drawHome = useCallback((c: Control) => sampleHome({ audits: eng.audits }, a => auditCovers(a, c, eng.id)), [eng.audits, eng.id]);

  // One file's draw. The items join the control's single list, tagged with the
  // file they came out of, so TOE keeps testing one list and the paper can still
  // say which file each item is from. Re-drawing the same file replaces its own
  // items and leaves every other file's alone.
  const drawSourceSample = useCallback<IcfrCtx['drawSourceSample']>((controlId, sourceId, draw, refs) => {
    if (role !== 'auditor' || awaitingDesignApproval(controlId)) return;
    patchControl(controlId, c => {
      const existing = populationSources(c);
      if (!existing.some(s => s.id === sourceId)) return c;
      const samp = c.operating.sampling;
      // Each item is dealt as the agreed methodology says (A28): a quarter of
      // the window, and — on a control answering for several companies — a
      // company, so the coverage strip can tell whether the draw reached each
      // one. The other files' items are what the deal evens out against; the
      // Sample step previewed the same deal, so the rows approved are these.
      const kept = (samp?.samples ?? []).filter(s => (s.sourceId ?? LEGACY_SOURCE_ID) !== sourceId);
      // Inside the months the file's ask named, when it named some.
      const stretch = drawAudit && draw.months ? { ...drawAudit, windowFrom: draw.months.from, windowTo: draw.months.to } : drawAudit;
      const dealt = dealSample(scopedForDraw(c, drawScope), stretch, drawMethod, refs.length, kept, `${seedKeyOf(c)}·${sourceId}`, e => countryOf(eng.id, e), drawHome(c));
      const added: Sample[] = refs.map((ref, i) => ({
        id: `${sourceId}-s${i}`, ref, result: 'Not tested', sourceId, ...dealt[i],
      }));
      const samples = [...kept, ...added];
      const sources = existing.map(s => (s.id === sourceId ? { ...s, draw } : s));
      const drawn = sources.filter(s => s.draw);
      const pop = c.operating.population;
      return {
        ...c,
        operating: {
          ...c.operating,
          population: pop ? { ...pop, sources } : pop,
          // A run recorded before this draw was testing the OLD items — flag it
          // stale; the next run (or a fresh attestation) clears it.
          steps: staleSteps(c.operating.steps),
          // Built fresh rather than spread, so a departure recorded against a
          // size that no longer exists goes with the draw it was argued about.
          sampling: {
            basis: `${samples.length} items drawn from ${drawn.length} of ${sources.length} source file${sources.length === 1 ? '' : 's'} · ${draw.method.toLowerCase()}, one seed per file · ${spreadPhrase(drawMethod.spread)}`,
            method: draw.method, size: samples.length, seed: draw.seed, samples,
          },
        },
      };
    });
    pushExec(prev => {
      const file = prev.controls.find(c => c.id === controlId)?.operating.population?.sources?.find(s => s.id === sourceId)?.file;
      return { controlId, track: 'operating', kind: 'sample', verb: `drew ${draw.size} items from ${file ?? 'a source file'} — ${draw.method.toLowerCase()}, seed ${draw.seed}`, target: file };
    });
  }, [patchControl, pushExec, role, awaitingDesignApproval, drawAudit, drawMethod, drawHome, eng.id]);

  // The tick on one file's accordion. Persisted rather than held on screen: a
  // control with ten files is not finished in one sitting, and the whole value
  // of the mark is that tomorrow it says which files are still owed.
  const approveSource = useCallback<IcfrCtx['approveSource']>((controlId, sourceId, which, on) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => {
      const pop = c.operating.population;
      if (!pop) return c;
      const key = which === 'ipe' ? 'approvedIpe' : 'approvedSample';
      const sources = populationSources(c).map(s => (s.id === sourceId ? { ...s, [key]: on ? { by: me, at: 'just now' } : undefined } : s));
      return { ...c, operating: { ...c.operating, population: { ...pop, sources } } };
    });
    pushExec(prev => {
      const file = prev.controls.find(c => c.id === controlId)?.operating.population?.sources?.find(s => s.id === sourceId)?.file;
      return { controlId, track: 'operating', kind: 'sample',
        verb: on ? `marked ${which === 'ipe' ? 'the report proof' : 'the sample'} done for a source file` : `took the mark back off a source file's ${which === 'ipe' ? 'proof' : 'sample'}`,
        target: file };
    });
  }, [patchControl, me, pushExec, role]);

  // "सैंपल आया, तुम सैंपल पढ़े, तुमको अच्छा नहीं लगा" — the draw goes back and
  // the file returns to its Draw sample state. Only this file: the point of
  // per-file draws is that a bad draw on one costs nothing on the others.
  const redrawSource = useCallback<IcfrCtx['redrawSource']>((controlId, sourceId) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => {
      const pop = c.operating.population;
      const samp = c.operating.sampling;
      if (!pop) return c;
      const gone = new Set(samplesFor(c, sourceId).map(s => s.id));
      const samples = (samp?.samples ?? []).filter(s => !gone.has(s.id));
      // The results recorded against the discarded items go with them, and each
      // attribute's verdict is re-derived off what is left — the same rule
      // dropping a file follows, for the same reason.
      const steps = c.operating.steps.map(st => {
        if (!st.sampleResults) return st;
        const kept = Object.fromEntries(Object.entries(st.sampleResults).filter(([id]) => !gone.has(id)));
        const vals = samples.map(it => kept[it.id] ?? 'Not tested');
        const derived: TestResult = vals.includes('Fail') ? 'Fail' : vals.length > 0 && vals.every(v => v === 'Pass') ? 'Pass' : 'Not tested';
        return { ...st, sampleResults: Object.keys(kept).length ? kept : undefined, result: st.override ? st.result : derived };
      });
      const sources = populationSources(c).map(s => (s.id === sourceId ? { ...s, draw: undefined, approvedSample: undefined } : s));
      return {
        ...c,
        operating: {
          ...c.operating,
          population: { ...pop, sources },
          sampling: samp && samples.length ? { ...samp, size: samples.length, samples } : undefined,
          exceptions: (c.operating.exceptions ?? []).filter(x => !gone.has(x.sampleId)),
          // the surviving runs were made over the old draw — stale until re-run
          steps: staleSteps(steps),
        },
      };
    });
    pushExec(prev => {
      const file = prev.controls.find(c => c.id === controlId)?.operating.population?.sources?.find(s => s.id === sourceId)?.file;
      return { controlId, track: 'operating', kind: 'sample', verb: 'rejected a source file\'s sample — the draw was reopened', target: file };
    });
  }, [patchControl, pushExec, role]);

  // "आपको RO को रिमाइंडर भी देना पड़ेगा ईमेल पे कि भाई यहाँ आओ और फाइल अपलोड
  // करो, इसकी नीड है." The same handoff the design documents already use — one
  // task list, one place the owner looks, rather than a second inbox for the
  // same kind of ask.
  const remindOwnerForFiles = useCallback<IcfrCtx['remindOwnerForFiles']>((controlId, what) => {
    if (role !== 'auditor') return;
    setEng(prev => {
      const ctrl = prev.controls.find(c => c.id === controlId);
      if (!ctrl) return prev;
      // Named, not addressed. An email address is not something anyone can look
      // a person up by, and the task has to land on somebody's list.
      const assignee = ownersOf(ctrl).processOwner;
      const task: HandoffTask = {
        id: uid('PBC'), type: 'pbc', controlId,
        title: 'Upload the source data for this control',
        detail: what,
        assignee, assigneeRole: 'risk-owner', raisedBy: me, dueLabel: 'Due in 3d', overdue: false, status: 'open',
        focus: 'population',
      };
      return { ...prev, tasks: [...prev.tasks, task] };
    });
    pushExec(() => ({ controlId, track: 'operating', kind: 'request-docs', verb: 'asked the owner to upload the source data', target: what }));
  }, [me, pushExec, role]);

  // ── The file registry ─────────────────────────────────────────────────────
  // Provenance is a property of the FILE, settled once when it enters the audit.
  // Registering is how a file a control uploaded becomes reusable by every other
  // control without anybody being asked the same question twice.
  const registerFile = useCallback<IcfrCtx['registerFile']>((rec) => {
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const reg = prev.fileRegistry ?? [];
      return { ...prev, fileRegistry: [...reg.filter(f => f.name !== rec.name), rec] };
    });
  }, []);

  /**
   * Correct a file's provenance.
   *
   * PARKED (user rule, Aug 2026): provenance is answered once, when the file
   * enters, and is not editable afterwards — the Configuration tab's registry
   * went read-only, leaving this with no caller. The mutator stays because its
   * semantics ARE the model, should an edit surface ever return: every control
   * that drew a population off the file reads the new answer automatically
   * (they hold no copy), and any that had already CONCLUDED gets a review note
   * rather than a silently restated paper.
   */
  const setFileOrigin = useCallback<IcfrCtx['setFileOrigin']>((name, origin) => {
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const reg = prev.fileRegistry ?? [];
      const existing = reg.find(f => f.name === name);
      if (existing?.origin === origin) return prev;
      const rec: AuditFileRecord = existing
        ? { ...existing, origin, originBy: me, originAt: 'just now' }
        // A derived file (scoping TB, GL, RACM upload) has no record until the
        // first time somebody says something about it. This is that moment.
        : { name, kind: 'Source file', rows: 0, from: 'Engagement files', uploadedBy: '—', uploadedAt: '—', origin, originBy: me, originAt: 'just now' };
      // Concluded controls sourced from this file — flagged, not rewritten. A
      // control still in progress needs no note: its conclusion has not been
      // reached yet, so it will be reached on the corrected basis.
      const affected = prev.controls.filter(c => {
        const concl = controlConclusion(c);
        // Any of the files the population stands on — a correction to the second
        // file is as much a change under a concluded paper as one to the first.
        return populationSources(c).some(s => s.file === name) && (concl === 'Effective' || concl === 'Ineffective');
      });
      const notes = affected.map(c => ({
        id: uid('rn'),
        controlId: c.id,
        text: `The source file "${name}" was re-recorded as ${origin.toLowerCase()} by ${me} after this control concluded. Confirm the conclusion still holds on that basis.`,
        raisedBy: 'System', raisedAt: 'just now', status: 'Open' as const,
      }));
      return {
        ...prev,
        fileRegistry: [...reg.filter(f => f.name !== name), rec],
        reviewNotes: [...notes, ...prev.reviewNotes],
      };
    });
  }, [me]);

  // Locking is the auditor's act — it is the moment the population stops being a
  // proposal and becomes the thing every later conclusion rests on.
  const lockPopulation = useCallback<IcfrCtx['lockPopulation']>((controlId) => {
    if (role !== 'auditor' || awaitingDesignApproval(controlId)) return;
    patchControl(controlId, c => (c.operating.population
      ? { ...c, operating: { ...c.operating, population: { ...c.operating.population, locked: { by: me, at: 'just now' } } } }
      : c));
    pushExec(() => ({ controlId, track: 'operating', kind: 'sample', verb: 'locked the population' }));
  }, [patchControl, me, pushExec, role, awaitingDesignApproval]);

  // Freeze what each sampled item will be tested against. Reopening is allowed
  // and logged: an attribute the field work proves wrong has to be fixable.
  const lockAttributes = useCallback<IcfrCtx['lockAttributes']>((controlId, locked) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, attributesLocked: locked ? { by: me, at: 'just now' } : undefined } }));
    pushExec(() => ({ controlId, track: 'operating', kind: 'sample', verb: locked ? 'locked the test attributes ahead of the draw' : 'reopened the test attributes' }));
  }, [patchControl, me, pushExec, role]);

  const confirmExtraction = useCallback<IcfrCtx['confirmExtraction']>((controlId) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, extractionConfirmed: { by: me, at: 'just now' } } }));
    pushExec(() => ({ controlId, track: 'operating', kind: 'sample', verb: 'confirmed the extraction — items trace to the locked population, method and seed recorded' }));
  }, [patchControl, me, pushExec, role]);

  // One judgement per failure. Re-judging the same failure replaces the entry
  // rather than stacking a second opinion on the same item.
  const recordException = useCallback<IcfrCtx['recordException']>((controlId, sampleId, stepId, kind, reason) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => {
      const rest = (c.operating.exceptions ?? []).filter(x => !(x.sampleId === sampleId && x.stepId === stepId));
      return { ...c, operating: { ...c.operating, exceptions: [...rest, { sampleId, stepId, kind, reason, by: me, at: 'just now' }] } };
    });
    pushExec(() => ({ controlId, track: 'operating', kind: 'sample', verb: `judged an exception a ${kind.toLowerCase()}`, target: reason }));
  }, [patchControl, me, pushExec, role]);

  const addEvidenceReport = useCallback<IcfrCtx['addEvidenceReport']>((controlId, name, usedFor, insideControl) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, evidenceReports: [...(c.operating.evidenceReports ?? []), { id: uid('rep'), name, usedFor, insideControl }] } }));
  }, [patchControl, role]);

  const removeEvidenceReport = useCallback<IcfrCtx['removeEvidenceReport']>((controlId, reportId) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, evidenceReports: (c.operating.evidenceReports ?? []).filter(r => r.id !== reportId) } }));
  }, [patchControl, role]);

  const proveEvidenceReport = useCallback<IcfrCtx['proveEvidenceReport']>((controlId, reportId, note) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({
      ...c,
      operating: { ...c.operating, evidenceReports: (c.operating.evidenceReports ?? []).map(r => r.id === reportId ? { ...r, proven: { by: me, at: 'just now', note } } : r) },
    }));
    pushExec(() => ({ controlId, track: 'operating', kind: 'ipe', verb: 'proved a report standing behind the evidence' }));
  }, [patchControl, me, pushExec, role]);

  // Tag / untag a management review control and keep its investigation threshold.
  const setMrc = useCallback<IcfrCtx['setMrc']>((controlId, isMrc, threshold) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({ ...c, isMrc, mrcThreshold: isMrc ? (threshold ?? c.mrcThreshold) : undefined }));
  }, [patchControl, role]);

  // Scoping front door — accounts are editable: in/out of scope, relevant
  // assertions, WCGW statements. Frozen once the engagement is countersigned.
  const updateAccount = useCallback<IcfrCtx['updateAccount']>((id, patch) => {
    if (role !== 'auditor') return;
    setEng(prev => isEngagementLocked(prev) ? prev : ({ ...prev, accounts: prev.accounts.map(a => a.id === id ? { ...a, ...patch } : a) }));
  }, [role]);

  // ── IPE — the report the population comes out of is itself under test ──────────
  // Registering seeds the three checks rather than asking the auditor to author
  // them: what has to be proven about an entity-produced report is settled, and a
  // blank box would invite a shorter list than the standard.
  const registerIpe = useCallback<IcfrCtx['registerIpe']>((controlId, meta) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({
      ...c,
      operating: {
        ...c.operating,
        ipe: {
          ...meta,
          // One set of four per source file. A population standing on three
          // files needs each of them proven — four checks covering "the report"
          // would be four checks covering whichever file happened to be first.
          // The tag is left off entirely when there is one file, so a
          // single-source control keeps reading exactly as it always has.
          checks: (() => {
            const srcs = populationSources(c);
            if (srcs.length <= 1) return ipeChecklist(meta.reportName).map(k => ({ ...k, id: uid('ipe') }));
            return srcs.flatMap(s => ipeChecklist(s.file).map(k => ({ ...k, id: uid('ipe'), sourceId: s.id })));
          })(),
          conclusion: 'Not tested',
          testedBy: null,
          testedAt: null,
        },
      },
    }));
    pushExec(() => ({ controlId, track: 'operating', kind: 'ipe', verb: `registered ${meta.reportName} as information produced by the entity`, target: meta.reportRef }));
  }, [patchControl, pushExec, role]);

  // One dimension's finding. Recording a result reopens the conclusion — a report
  // concluded reliable on three passes cannot keep that conclusion once one flips.
  const setIpeCheck = useCallback<IcfrCtx['setIpeCheck']>((controlId, checkId, patch) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => {
      const ipe = c.operating.ipe;
      if (!ipe) return c;
      const checks = ipe.checks.map(k => (k.id === checkId ? { ...k, ...patch } : k));
      const reset = patch.result !== undefined;
      // Answering a check again takes the tick back off the file it belongs to.
      // A mark that survived the work it stood for would say "this file is
      // settled" over a dimension somebody has just reopened.
      const pop = c.operating.population;
      const src = reset ? (ipe.checks.find(k => k.id === checkId)?.sourceId ?? LEGACY_SOURCE_ID) : null;
      return {
        ...c,
        operating: {
          ...c.operating,
          population: pop && src ? { ...pop, sources: populationSources(c).map(s => (s.id === src ? { ...s, approvedIpe: undefined } : s)) } : pop,
          ipe: reset
            ? { ...ipe, checks, conclusion: 'Not tested', testedBy: null, testedAt: null }
            : { ...ipe, checks },
        },
      };
    });
    if (patch.result) {
      pushExec(prev => {
        const k = prev.controls.find(c => c.id === controlId)?.operating.ipe?.checks.find(x => x.id === checkId);
        return k ? { controlId, track: 'operating', kind: 'ipe', verb: `tested the report's ${k.dimension.toLowerCase()}`, target: k.dimension, result: k.result } : null;
      });
    }
    // The proof itself is a fact on the paper, not a detail of the result — an
    // auditor who says the count ties and an auditor who shows the screen they
    // counted it on have not done the same thing.
    if (patch.evidence) {
      pushExec(prev => {
        const k = prev.controls.find(c => c.id === controlId)?.operating.ipe?.checks.find(x => x.id === checkId);
        const last = patch.evidence?.[patch.evidence.length - 1];
        return k && last ? { controlId, track: 'operating', kind: 'ipe', verb: `attached proof of the report's ${k.dimension.toLowerCase()}`, target: last.name } : null;
      });
    }
  }, [patchControl, pushExec, role]);

  const concludeIpe = useCallback<IcfrCtx['concludeIpe']>((controlId, conclusion) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => (c.operating.ipe
      ? { ...c, operating: { ...c.operating, ipe: { ...c.operating.ipe, conclusion, testedBy: me, testedAt: 'just now' } } }
      : c));
    pushExec(() => ({ controlId, track: 'operating', kind: 'ipe', verb: `concluded the report ${conclusion.toLowerCase()}` }));
  }, [patchControl, me, pushExec, role]);

  // The wrong extract was registered. The checks proved THAT file, so they go too.
  const clearIpe = useCallback<IcfrCtx['clearIpe']>((controlId) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, ipe: undefined } }));
    pushExec(() => ({ controlId, track: 'operating', kind: 'ipe', verb: 'withdrew the registered report — IPE testing restarted' }));
  }, [patchControl, pushExec, role]);

  const setSampling = useCallback<IcfrCtx['setSampling']>((controlId, sampling) => {
    if (role !== 'auditor' || awaitingDesignApproval(controlId)) return;
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, sampling } }));
  }, [patchControl, role, awaitingDesignApproval]);

  // Any failure means extend the sample — never "small miss, ignore" (handbook).
  // Extending stays inside the round it happens in; it is not a new round. It
  // closes once the last round has failed, because the finding is settled by
  // then and more items cannot unsettle it — see canExtendToe.
  const extendSample = useCallback<IcfrCtx['extendSample']>((controlId, extra) => {
    if (role !== 'auditor' || awaitingDesignApproval(controlId)) return;
    patchControl(controlId, c => {
      const s = c.operating.sampling;
      if (!s) return c;
      if (!canExtendToe(c)) return c;
      // Tagged as the extension round: appended to the one list the results are
      // keyed against, but distinguishable on the paper from the original draw.
      // Also tagged with a source file, because an untagged item on a control
      // standing on several belongs to none of them — it would disappear from
      // every per-file row while still being tested and still being counted.
      // The failure that triggered the extension is not attributed to a file, so
      // the first one is used; the exception's own file is what a later round of
      // this work will read (see PopulationSource).
      const src = populationSources(c)[0]?.id;
      // An extension is often the answer to a coverage shortfall — "extend the
      // sample" is what the Sample step tells the auditor when a company, a
      // country or a quarter has no items. So the deal fills the groups the draw
      // left empty FIRST, and only then evens out the rest (A28, dealSample).
      const dealt = dealSample(scopedForDraw(c, drawScope), drawAudit, drawMethod, extra, s.samples, `${seedKeyOf(c)}·ext`, e => countryOf(eng.id, e), drawHome(c));
      const added = sampleRefs(c.process, s.size + extra).slice(s.size).map((ref, i) => (
        { id: `s${s.size + i}`, ref, result: 'Not tested' as TestResult, extension: true, sourceId: src, ...dealt[i] }
      ));
      // runs recorded before the extension never saw the new items — stale until re-run
      return { ...c, operating: { ...c.operating, steps: staleSteps(c.operating.steps), sampling: { ...s, size: s.size + extra, samples: [...s.samples, ...added], basis: `${s.size + extra} items — extended +${extra} after a failure (a miss is never ignored).` } } };
    });
    pushExec(() => ({ controlId, track: 'operating', kind: 'sample', verb: `extended the sample by ${extra} after a failure`, target: `+${extra} items` }));
  }, [patchControl, pushExec, role, awaitingDesignApproval, drawAudit, drawMethod, drawHome, eng.id]);

  // Revise a drawn sample up or down. Growing appends fresh refs; shrinking keeps
  // the first N items (so results already recorded against them survive) and drops
  // the rest — including their per-attribute results, which would otherwise linger
  // as orphans keyed to sample ids that no longer exist.
  //
  // Since #22 the size is not the auditor's to set: the engagement agrees one
  // sizing table and every control reads its number off it. So this is a
  // DEPARTURE from that agreement, never an edit — refused without a reason (as
  // `reviseSampling` refuses one), recorded against the number the table gave,
  // and named as a departure on the basis and on the trail. It is never blocked;
  // it is only made impossible to mistake for an ordinary value.
  const resizeSample = useCallback<IcfrCtx['resizeSample']>((controlId, size, reason) => {
    if (role !== 'auditor' || awaitingDesignApproval(controlId)) return;
    const why = reason.trim();
    if (!why) return;
    // What the agreed table gives for this control, read before the change so the
    // departure can be stated against it — and so the trail can say it too.
    const before = eng.controls.find(c => c.id === controlId);
    if (!before) return;
    const agreed = sampleSizeGuide(before, itgcHolds(eng, before), samplingOf(eng)).suggested;
    patchControl(controlId, c => {
      const s = c.operating.sampling;
      if (!s || size < 1 || size === s.size) return c;
      // Growing deals the new items by the audit's methodology, like any draw (A28).
      const dealt = size > s.size ? dealSample(scopedForDraw(c, drawScope), drawAudit, drawMethod, size - s.size, s.samples, `${seedKeyOf(c)}·resize`, e => countryOf(eng.id, e), drawHome(c)) : [];
      const samples = size > s.size
        ? [...s.samples, ...sampleRefs(c.process, size).slice(s.size).map((ref, i) => ({ id: `s${s.size + i}`, ref, result: 'Not tested' as TestResult, ...dealt[i] }))]
        : s.samples.slice(0, size);
      const kept = new Set(samples.map(x => x.id));
      const steps = c.operating.steps.map(st => st.sampleResults
        ? { ...st, sampleResults: Object.fromEntries(Object.entries(st.sampleResults).filter(([id]) => kept.has(id))) }
        : st);
      // the revised draw is not the one the recorded runs tested — stale until re-run
      return { ...c, operating: { ...c.operating, steps: staleSteps(steps), sampling: {
        ...s, size, samples,
        override: { size, agreed, reason: why, by: me, at: 'just now' },
        basis: `${size} items — a departure from the agreed methodology (agreed: ${agreed}). ${why}`,
      } } };
    });
    pushExec(() => ({ controlId, track: 'operating', kind: 'sample', verb: `departed from the agreed sample size — ${size} items where the methodology gives ${agreed}`, target: `${size} items` }));
  }, [patchControl, pushExec, role, me, awaitingDesignApproval, drawAudit, drawMethod, drawHome, eng]);

  const setStepResult = useCallback<IcfrCtx['setStepResult']>((controlId, stepId, result) => {
    if (role !== 'auditor' || awaitingDesignApproval(controlId)) return;
    // No Pass without the evidence (17 Sep): every required file has to be in.
    // Fail never waits.
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, steps: c.operating.steps.map(s => {
      if (s.id !== stepId) return s;
      if (result === 'Pass' && !requiredFilesReady(s, c)) return s;
      return stampSamples(c, { ...s, result }, result);
    }) } }));
    if (result === 'Fail') raiseDeficiencyIfIneffective(controlId, 'operating', true);
  }, [patchControl, role, raiseDeficiencyIfIneffective, awaitingDesignApproval]);

  // Record one attribute's result against ONE drawn sample; the attribute's own
  // result derives from its samples (any fail ⇒ Fail, all pass ⇒ Pass).
  const setSampleResult = useCallback<IcfrCtx['setSampleResult']>((controlId, stepId, sampleId, result) => {
    if (role !== 'auditor' || awaitingDesignApproval(controlId)) return;
    patchControl(controlId, c => {
      const samp = c.operating.sampling;
      if (!samp) return c;
      return { ...c, operating: { ...c.operating, steps: c.operating.steps.map(s => {
        if (s.id !== stepId) return s;
        const m: Record<string, TestResult> = { ...(s.sampleResults ?? {}), [sampleId]: result };
        const vals = samp.samples.map(it => m[it.id] ?? 'Not tested');
        const derived: TestResult = vals.includes('Fail') ? 'Fail' : vals.every(v => v === 'Pass') ? 'Pass' : 'Not tested';
        return { ...s, sampleResults: m, result: derived };
      }) } };
    });
    if (result === 'Fail') raiseDeficiencyIfIneffective(controlId, 'operating', true);
  }, [patchControl, role, raiseDeficiencyIfIneffective, awaitingDesignApproval]);

  const overrideStep = useCallback<IcfrCtx['overrideStep']>((controlId, stepId, override) => {
    if (role !== 'auditor' || (override && awaitingDesignApproval(controlId))) return;
    // An override to Pass still needs the files (17 Sep); to Fail it never waits.
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, steps: c.operating.steps.map(s => {
      if (s.id !== stepId) return s;
      if (override?.result === 'Pass' && !requiredFilesReady(s, c)) return s;
      return { ...s, override: override ?? undefined };
    }) } }));
  }, [patchControl, role, awaitingDesignApproval]);

  const patchStep = useCallback((controlId: string, stepId: string, fn: (s: OperatingStep, c: Control) => OperatingStep) => {
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, steps: c.operating.steps.map(s => s.id === stepId ? fn(s, c) : s) } }));
  }, [patchControl]);

  // Append one run record to the registry the Runs tab reads. `make` runs against
  // fresh post-action state (queued after the action's setEng), like pushExec.
  const pushRun = useCallback((make: (prev: IcfrEngagement) => Omit<RunRecord, 'id' | 'by' | 'role' | 'at'> | null) => {
    setEng(prev => {
      const draft = make(prev);
      if (!draft) return prev;
      const run: RunRecord = { id: uid('run'), by: me, role, at: 'just now', ...draft };
      return { ...prev, runs: [run, ...prev.runs] };
    });
  }, [me, role]);

  // Newest first, matching pushRun — the Audit logs list reads it in order.
  //
  // A new audit starts from zero: every control it covers goes back to Not tested
  // on both tracks, and everything last cycle's testing left behind goes with
  // them. An audit is a fresh cycle, so inheriting any of it would claim work this
  // audit never did.
  //
  // Only the controls in THIS audit's scope are reset — another audit scoped to
  // different entities keeps its own progress.
  const createAudit = useCallback((draft: Omit<AuditRecord, 'id' | 'by' | 'role' | 'at'>, opts?: { freshControlIds?: string[] }) => {
    setEng(prev => {
      // Stamped with the methodology in force right now, and it finishes on
      // that version however the methodology moves afterwards (#22).
      const audit: AuditRecord = { id: uid('audit'), by: me, role, at: 'just now', samplingVersion: samplingOf(prev).version, ...draft };
      // Creating an audit OPENS it (user ask): the sheet closes onto the new
      // audit's own workspace — Dashboard, Control Library, Deficiency
      // management, Configuration — with its controls reset to Not started
      // below. Set outside setEng's return so it lands with the same commit.
      setOpenAuditId(audit.id);
      setTabState('overview');
      setView('overview');
      // Same precedence the workspace filter uses: controls picked one by one on
      // the scope step decide, and only when none were does the process filter.
      const picked = audit.controlIds?.length ? new Set(audit.controlIds) : null;
      const procs = processesForAudit(audit, prev.id);
      const covers = (c: Control) => (picked
        ? picked.has(c.id)
        : !procs || procs.includes(normaliseProcess(c.process)));
      // A control added on this wizard's scope step was born for this audit: it
      // has no last cycle to archive, and resetting it would wipe the design
      // checks typed in when it was added. Everything else in scope resets.
      const fresh = new Set(opts?.freshControlIds ?? []);
      const resetIds = new Set(prev.controls.filter(c => covers(c) && !fresh.has(c.id)).map(c => c.id));
      const hit = (controlId: string) => resetIds.has(controlId);

      // ARCHIVE, don't delete. The outgoing cycle's results are snapshotted onto
      // the audit that produced them before the controls are reset, so the
      // engagement's portfolio can read prior-year deficiencies, what a control
      // concluded last year, and last year's ICFR opinion. Deleting them — which
      // is what this did — made every one of those questions unanswerable.
      //
      // Which audit owns them: the live one, i.e. the newest audit that is not
      // itself already archived. There is only ever one, because creating an
      // audit archives whatever was live.
      const liveIdx = prev.audits.findIndex(a => !a.archive);
      const live = liveIdx >= 0 ? prev.audits[liveIdx] : undefined;
      const archive: AuditArchive | undefined = live && resetIds.size ? {
        conclusions: prev.controls.filter(c => resetIds.has(c.id)).map(c => ({
          controlId: c.id,
          wpRef: c.wpRef,
          process: c.process,
          description: c.description,
          design: c.design.conclusion,
          operating: c.operating.conclusion,
          conclusion: controlConclusion(c),
          // What the year's running total reads for this round once the
          // controls reset (A28) — the items are about to go with them.
          samplesTested: samplesTestedCount(c),
        })),
        // Severity is resolved NOW: assessSeverity applies the compensating-control
        // cap against the live engagement, and that engagement is about to change.
        // All four grades — a clearly trivial finding archives as Clearly Trivial.
        deficiencies: prev.deficiencies.filter(d => hit(d.controlId))
          .map(d => ({ ...d, severity: assessSeverity(d, prev).final })),
        concludedAt: 'just now',
      } : undefined;

      return {
        ...prev,
        audits: [
          audit,
          ...prev.audits.map((a, i) => (i === liveIdx && archive
            // The outgoing audit keeps its results, and its ICFR conclusion with
            // them. Sign-off is per audit, so whatever it was signed as stands.
            // Except an interim: its window never reaches the year end, so it
            // archives WITHOUT a final-year verdict (user ask) — the opinion
            // belongs to the roll-forward or year-end that closes the year.
            ? { ...a, archive, signoff: { ...a.signoff, ...(a.round !== 'interim' ? { icfrConclusion: icfrConclusion(prev) } : {}) } }
            : a)),
        ],
        // A roll-forward retests TOD only where TOD failed (user ask): a design
        // the parent interim concluded effective CARRIES — marked, so the
        // control page says where the conclusion came from — and only the
        // operating track starts over. Everything else (failed design, or any
        // non-roll-forward audit) resets in full, exactly as before. The
        // parent's verdicts are read from wherever they live: still on the
        // controls while the parent is the live signed cycle, or from its
        // archive snapshot once a later audit displaced it.
        controls: (() => {
          const rfParent = draft.round === 'rollforward' && draft.rolledFromId
            ? prev.audits.find(a => a.id === draft.rolledFromId)
            : undefined;
          const parentDesignOf = (id: string) => {
            if (!rfParent) return undefined;
            if (rfParent.archive) return rfParent.archive.conclusions.find(x => x.controlId === id)?.design;
            const c = prev.controls.find(x => x.id === id);
            return c ? trackResult(c.design) : undefined;
          };
          return prev.controls.map(c => {
            if (!resetIds.has(c.id)) return c;
            const fresh = untested(c);
            if (rfParent && parentDesignOf(c.id) === 'Effective') {
              const carriedFrom = `${rfParent.period} interim`;
              // The approval travels with the conclusion (S6, A36). The interim
              // had to be countersigned before it could be rolled forward, so its
              // design was read; without this the roll-forward's Population,
              // Sample and TOE would sit locked behind a design nobody is being
              // asked to test again. An approval already on the live control is
              // kept as it was.
              const carriedApproval = (d: Control['design']) => (d.approval?.approvedBy ? d.approval : {
                preparedBy: d.approval?.preparedBy ?? { by: d.testedBy ?? prev.preparer, at: d.testedAt ?? rfParent.signoff?.preparer?.at ?? carriedFrom },
                approvedBy: { by: rfParent.signoff?.reviewer?.by ?? prev.reviewer, at: rfParent.signoff?.reviewer?.at ?? carriedFrom },
              });
              return {
                ...fresh,
                design: rfParent.archive
                  // The parent's evidence went into its archive with it — the
                  // carried conclusion stands on the marker alone.
                  ? { ...fresh.design, conclusion: 'Effective' as const, carriedFrom, approval: carriedApproval(fresh.design) }
                  // The parent's results were still live — the walkthrough and
                  // design points genuinely back the conclusion, so they travel.
                  : { ...c.design, carriedFrom, approval: carriedApproval(c.design), designReturn: undefined },
              };
            }
            return fresh;
          });
        })(),
        // A CLOSED exception is a conclusion about a control, so it cannot outlive
        // the result it came from — it lives on in the archive above, never deleted.
        //
        // An OPEN one carries forward. It did not stop being true because the year
        // turned: the control is still broken, the fix is still owed, and the new
        // cycle's first job is to verify the prior period's open items rather than
        // rediscover them. Archiving them would have quietly reset the count to
        // zero every roll-forward, which is the one number nobody should be able
        // to lose by waiting.
        deficiencies: prev.deficiencies.filter(d => !hit(d.controlId) || d.status !== 'Closed'),
        // The control page reads its history out of `executions`; leaving last
        // cycle's runs there would show "tested by A. Mehta" on a control the
        // page also calls Not tested.
        executions: prev.executions.filter(e => !hit(e.controlId)),
        // Open PBCs and queries were raised against evidence that is no longer
        // received, and remediations against deficiencies that no longer exist.
        tasks: prev.tasks.filter(t => !hit(t.controlId)),
        // Review notes challenge a paper. The paper is unsigned and unconcluded
        // again, so an open note would block a countersign on nothing.
        reviewNotes: prev.reviewNotes.filter(n => !hit(n.controlId)),
        // A run whose every control was reset has no surviving outcome to show.
        runs: prev.runs.filter(r => !r.controls.every(rc => hit(rc.controlId))),
      };
    });
  }, [me, role]);

  const updateAudit = useCallback((auditId: string, patch: Partial<AuditRecord>) => {
    setEng(prev => ({
      ...prev,
      audits: prev.audits.map(a => (a.id === auditId ? { ...a, ...patch } : a)),
    }));
  }, []);

  // Drilling into an audit swaps the whole level: the engagement's Dashboard /
  // Audit logs tabs give way to that audit's Overview / RACM / Control Library /
  // Configuration. Opening one resets to its Overview so the drill-in never
  // lands on a tab left over from a previous audit.
  const openAudit = useCallback((auditId: string) => {
    setOpenAuditId(auditId);
    setTabState('overview');
    setView('overview');
  }, []);

  // Land on the exception itself. openAudit resets the tab by design, so the tab
  // is set AFTER it rather than alongside — otherwise the reset wins and the
  // reader arrives on the audit dashboard wondering what they clicked.
  const openDeficiency = useCallback<IcfrCtx['openDeficiency']>((defId) => {
    const target = eng.deficiencies.find(d => d.id === defId);
    // Same wall as openControl: a finding belongs to a control, and the owner
    // only sees findings on controls they answer for.
    if (role === 'risk-owner' && target) {
      const c = eng.controls.find(x => x.id === target.controlId);
      if (c && !isOwnerOf(c, meOwner)) {
        const W = defWord(eng.id);
        addToast({
          type: 'info', title: `This ${W.one} is not yours to open`,
          message: `${target.id} sits on ${c.wpRef}, which ${ownersOf(c).controlOwner} answers for.`,
        });
        return;
      }
    }
    setFocusDefId(defId);
    const owning = target && eng.audits.find(a => a.controlIds?.includes(target.controlId));
    if (owning && owning.id !== openAuditId) { openAudit(owning.id); setTabState('deficiencies'); return; }
    if (openAuditId) setTabState('deficiencies'); else setView('deficiencies');
  }, [eng.id, eng.controls, eng.deficiencies, eng.audits, openAuditId, openAudit, role, meOwner, addToast]);
  // Leaving an audit lands on the engagement's own Overview. Without the reset,
  // closing from the audit's Configuration or Deficiency management tab — neither
  // of which the engagement level has — left the tab bar with nothing active and
  // AuditConfigView rendering null: a blank page.
  const closeAudit = useCallback(() => {
    setOpenAuditId(null);
    setTabState('overview');
    setView('overview');
  }, []);

  const controlOutcome = (c: Control): RunControlOutcome => ({
    controlId: c.id, wpRef: c.wpRef, description: c.description,
    outcome: c.design.points.some(p => p.result === 'Fail') || c.operating.steps.some(s => stepResult(s) === 'Fail') ? 'Ineffective' : 'Effective',
    checks: c.design.points.length + c.operating.steps.length,
  });

  const pullStepRun = useCallback<IcfrCtx['pullStepRun']>((controlId, stepId) => {
    if (role !== 'auditor' || awaitingDesignApproval(controlId)) return;
    patchStep(controlId, stepId, (s, c) => {
      const res = s.result === 'Not tested' ? 'Pass' : s.result;
      return stampSamples(c, { ...s, workflowRunRef: `${wfRunRef(controlId + s.id, res === 'Fail')} · just now`, result: res, staleRun: undefined }, res);
    });
    pushExec(prev => { const s = prev.controls.find(c => c.id === controlId)?.operating.steps.find(st => st.id === stepId); return s ? { controlId, track: 'operating', kind: 'pull-run', verb: 'pulled a workflow run', target: s.code, result: s.result } : null; });
    pushRun(prev => {
      const c = prev.controls.find(cc => cc.id === controlId);
      const s = c?.operating.steps.find(st => st.id === stepId);
      if (!c || !s) return null;
      return {
        kind: 'workflow-run', label: `Workflow run — ${s.workflowName ?? s.code}`,
        detail: `${c.wpRef} · ${s.code} · ${s.workflowRunRef ?? 'run · just now'}`,
        controls: [{ controlId: c.id, wpRef: c.wpRef, description: c.description, outcome: s.result === 'Fail' ? 'Ineffective' : 'Effective', checks: 1 }],
      };
    });
  }, [patchStep, pushExec, pushRun, role, awaitingDesignApproval]);

  // Self-attestation stays a first-line voice — owner or auditor, never the reviewer.
  //
  // And a voice is all it is. An attestation IS the attribute's result only when
  // nothing was validated against a file; where a validation already reached the
  // opposite conclusion, the validation is what the attribute tested and this
  // records the statement WITHOUT moving the result (PRD 8.4 / R8.5 — attestation
  // supports evidence, it does not overrule it). Nothing is blocked: the note and
  // its evidence go on the record either way, and the auditor still has the
  // override if they judge the file wrong — a named act with a reason on it.
  const attestStep = useCallback<IcfrCtx['attestStep']>((controlId, stepId, note, result) => {
    if (role === 'reviewer' || awaitingDesignApproval(controlId)) return;
    // An attested Pass needs the required files like any other Pass (17 Sep).
    let refused = false;
    patchStep(controlId, stepId, (s, c) => {
      if (result === 'Pass' && !requiredFilesReady(s, c)) { refused = true; return s; }
      const att: Attestation = { result, note, by: me, role, at: 'just now', evidence: s.attestation?.evidence ?? [] };
      const overruled = !!(s.validation?.result && s.validation.result !== result);
      // A stale run is stale evidence, and an attestation is not a re-run of it:
      // only running the validation again can answer for the current draw.
      if (overruled) return { ...s, attestEnabled: true, attestation: att };
      return stampSamples(c, { ...s, attestEnabled: true, attestation: att, result, staleRun: s.validation ? s.staleRun : undefined }, result);
    });
    pushExec(prev => {
      const s = prev.controls.find(c => c.id === controlId)?.operating.steps.find(st => st.id === stepId);
      if (!s || refused) return null;
      const overruled = attestationOverruled(s);
      return { controlId, track: 'operating', kind: 'attest', target: s.code, result: stepResult(s),
        verb: overruled ? `attested ${result.toLowerCase()} — the validation stands` : `attested ${result.toLowerCase()}` };
    });
  }, [patchStep, me, role, pushExec, awaitingDesignApproval]);

  const addStepEvidence = useCallback<IcfrCtx['addStepEvidence']>((controlId, stepId, fileName) => {
    if (role === 'reviewer') return;
    patchStep(controlId, stepId, s => {
      const ev: EvidenceFile = { id: uid('f'), name: fileName, kind: fileName.endsWith('.xlsx') ? 'XLSX' : 'PDF', uploadedBy: me, uploadedAt: 'just now' };
      const att: Attestation = s.attestation ?? { note: '', by: me, role, at: 'just now', evidence: [] };
      return { ...s, attestEnabled: true, attestation: { ...att, evidence: [...att.evidence, ev] } };
    });
  }, [patchStep, me, role]);

  const setStepInputFile = useCallback<IcfrCtx['setStepInputFile']>((controlId, stepId, fileName) => {
    if (role !== 'auditor') return;
    patchStep(controlId, stepId, s => ({ ...s, inputFile: { id: uid('f'), name: fileName, kind: fileName.endsWith('.xlsx') ? 'XLSX' : fileName.endsWith('.csv') ? 'CSV' : 'PDF', uploadedBy: me, uploadedAt: 'just now' } }));
  }, [patchStep, me, role]);

  // An attribute is what the control will be TESTED against, so it is the
  // auditor's to write — the owner running the control cannot set the questions
  // their own work is marked on, however well they know its shape. (This used to
  // admit the owner too. It is the one place the first line could quietly shape
  // the test, which is exactly what independence means here.)
  const addAttribute = useCallback<IcfrCtx['addAttribute']>((controlId, description) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => {
      const step: OperatingStep = { id: uid('os'), code: `${c.wpRef}.${c.operating.steps.length + 1}`, description, assertion: 'Accuracy', precision: 'Per item', procedures: ['Inspection'], result: 'Not tested' };
      return { ...c, operating: { ...c.operating, steps: [...c.operating.steps, step] } };
    });
  }, [patchControl, role]);
  const removeAttribute = useCallback<IcfrCtx['removeAttribute']>((controlId, stepId) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, steps: c.operating.steps.filter(s => s.id !== stepId) } }));
  }, [patchControl, role]);
  const mapStepWorkflow = useCallback<IcfrCtx['mapStepWorkflow']>((controlId, stepId, name) => {
    if (role !== 'auditor') return;
    patchStep(controlId, stepId, s => ({ ...s, evidenceMode: 'workflow', workflowId: uid('wf'), workflowName: name, workflowRunRef: undefined }));
  }, [patchStep, role]);
  const setStepEvidenceMode = useCallback<IcfrCtx['setStepEvidenceMode']>((controlId, stepId, mode) => {
    if (role !== 'auditor') return;
    patchStep(controlId, stepId, s => ({ ...s, evidenceMode: mode }));
  }, [patchStep, role]);
  const toggleStepAttest = useCallback<IcfrCtx['toggleStepAttest']>((controlId, stepId, enabled) => {
    if (role === 'reviewer') return;
    patchStep(controlId, stepId, s => ({ ...s, attestEnabled: enabled }));
  }, [patchStep, role]);
  const toggleStepAI = useCallback<IcfrCtx['toggleStepAI']>((controlId, stepId, on) => {
    if (role !== 'auditor') return;
    patchStep(controlId, stepId, s => ({ ...s, aiValidation: on }));
  }, [patchStep, role]);
  // AI validation reads every required file, so it runs only once all are in —
  // an attribute validated against half its evidence was not validated. The
  // refusal is silent here; the button says why before it is ever pressed.
  const validatedStep = (s: OperatingStep, c: Control, controlId: string): OperatingStep => {
    const willFail = (s.override ? s.override.result : s.result) === 'Fail';
    const res: TestResult = willFail ? 'Fail' : 'Pass';
    const names = requiredFilesOf(s, c).map(f => f.file?.name).filter(Boolean).join(', ');
    return stampSamples(c, { ...s, result: res, staleRun: undefined, workflowRunRef: 'Ask IRA · validated · just now', validation: { result: res, qa: validationQA(s.description, willFail), summary: validationSummary(c, s, willFail, controlId + s.id), table: validationTable(c, s, willFail, controlId + s.id), fileName: names || undefined, at: 'just now' } }, res);
  };
  const runStepValidation = useCallback<IcfrCtx['runStepValidation']>((controlId, stepId) => {
    if (role !== 'auditor' || awaitingDesignApproval(controlId)) return;
    let ran = false;
    patchStep(controlId, stepId, (s, c) => {
      if (!requiredFilesReady(s, c)) return s;
      ran = true;
      return validatedStep(s, c, controlId);
    });
    pushExec(prev => { const s = prev.controls.find(c => c.id === controlId)?.operating.steps.find(st => st.id === stepId); return s && ran ? { controlId, track: 'operating', kind: 'validate', verb: 'validated against its required files', target: s.code, result: s.result } : null; });
    pushRun(prev => {
      const c = prev.controls.find(cc => cc.id === controlId);
      const s = c?.operating.steps.find(st => st.id === stepId);
      if (!c || !s || !ran) return null;
      const names = requiredFilesOf(s, c).map(f => f.file?.name).filter(Boolean);
      return {
        kind: 'ai-validation', label: `AI validation — ${c.wpRef} · ${s.code}`,
        detail: `Checked against ${names.length} required file${names.length === 1 ? '' : 's'}: ${names.join(', ')}`,
        controls: [{ controlId: c.id, wpRef: c.wpRef, description: c.description, outcome: s.result === 'Fail' ? 'Ineffective' : 'Effective', checks: 1 }],
      };
    });
  }, [patchStep, pushExec, pushRun, role, awaitingDesignApproval]);

  // ── Ira on the design checks (S6, A17) ──────────────────────────────────────
  // Down here with TOE's AI validation rather than up with the design track:
  // it writes a Runs entry, and `pushRun` is only declared above this point.
  //
  // Run when the auditor asks — never on upload. Every check comes back Pass or
  // Fail, and in this prototype the verdict is deterministic:
  //   · a REQUIRED element still outstanding (no file, not waived) fails every
  //     check, and the summary names what is missing — Ira can't confirm a design
  //     against a document it hasn't seen;
  //   · otherwise a check fails only if its own result already stood Fail before
  //     the run — the rule TOE's AI validation uses (`validatedStep`).
  // Ira also links every element that has files to each check's "Evidenced by",
  // on top of the links the auditor made by hand.
  //
  // An override is left exactly where it is. Ira's answer lands on `result` and
  // `validation`, and the override keeps sitting on top of it (`pointResult`).
  // `validateDesignPoint` above still clears one, for its own callers.
  const runDesignIra = useCallback<IcfrCtx['runDesignIra']>((controlId) => {
    if (role !== 'auditor') return;
    const at = fmtDateTime();
    let tally: { checks: number; failed: number; blocked: number; files: string[] } | null = null;
    patchControl(controlId, c => {
      const d = c.design;
      const onFile = d.documents.filter(doc => designFilesOf(doc).length > 0);
      if (d.conclusion !== 'Not tested' || d.points.length === 0 || onFile.length === 0) return c;
      const label = (doc: DesignDoc) => (doc.kind === 'Custom' ? doc.name : doc.kind);
      const missing = designOutstanding(c).filter(doc => doc.required !== false).map(label);
      // A required element that is not on file stops the test, rather than
      // failing every check on its absence (user ask, 22 Sep). The old
      // behaviour wrote a run into the paper whose only finding was that the
      // evidence had not arrived — a verdict on the file room, recorded as a
      // verdict on the control. Refusing here shuts every door at once: the
      // page's button, the chat's, and a typed instruction all read the same
      // reason off `iraBlocked` and none of them can get round it.
      if (missing.length > 0) return c;
      const read = onFile.map(label);
      const files = onFile.flatMap(doc => designFilesOf(doc).map(f => f.name));
      const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
      const the = (xs: string[]) => list(xs.map(x => `the ${x}`));
      const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
      let failed = 0;
      let blocked = 0;
      const points = d.points.map(p => {
        // ── the check Ira cannot answer (user ask, 22 Sep) ──────────────────
        // It read what was there and nothing in it speaks to this question —
        // the element that would answer it has no file, or is not on the
        // control at all. The honest outcome is to say so and leave the check
        // where it was: NOT TESTED, still the auditor's to mark by hand, still
        // holding Effective back. Writing a Pass here would make a check
        // nobody could assess indistinguishable on the paper from one that
        // held, which is the failure mode this whole guard exists to prevent.
        const cannot = iraCannotTest(p, c);
        if (cannot) {
          blocked += 1;
          return {
            ...p,
            // `result` untouched, and no `result` on the validation either —
            // there is no verdict, and an absent one is the only honest shape.
            workflowRunRef: `Ask IRA · could not test · ${at}`,
            validation: {
              qa: [{ q: IRA_COULD_TEST_Q, a: cannot.reason, pass: false }],
              blocked: cannot.reason,
              summary: cannot.kind === 'missing'
                ? `Ira could not test this one — the evidence it points at has not been attached yet.`
                : `Ira could not test this one — what is on file does not answer it.`,
              fileName: files.join(', ') || undefined,
              at,
            },
          };
        }
        // What the check stood at before this run. A failure that was only Ira's
        // own "not on file yet" is not a failure to carry into the next run —
        // otherwise uploading the missing element could never clear it — so that
        // case reads the result as it stood before THAT run, which the earlier
        // Q&A kept for exactly this.
        const lastWasMissing = p.validation?.qa.some(x => x.q === IRA_ON_FILE_Q && !x.pass);
        const stoodFailed = lastWasMissing ? !!p.validation?.qa.some(x => x.q === IRA_STOOD_FAILED_Q) : p.result === 'Fail';
        const willFail = missing.length > 0 || stoodFailed;
        if (willFail) failed += 1;
        const res: TestResult = willFail ? 'Fail' : 'Pass';
        const stoodLine = { q: IRA_STOOD_FAILED_Q, a: 'Yes — it was marked failed before Ira ran.', pass: false };
        const qa = missing.length > 0
          ? [{ q: IRA_ON_FILE_Q, a: `No — ${list(missing)} ${missing.length === 1 ? 'isn’t' : 'aren’t'} on file yet.`, pass: false }, ...(stoodFailed ? [stoodLine] : [])]
          : [{ q: IRA_ON_FILE_Q, a: 'Yes — every required element is on file or accounted for.', pass: true }, ...designCheckQA(p.text, willFail)];
        const summary = missing.length > 0
          ? `${cap(the(missing))} ${missing.length === 1 ? 'isn’t' : 'aren’t'} on file yet, so Ira couldn’t confirm this check.`
          : willFail
            ? `Ira read ${the(read)}, and the design falls short on this check — the answers below say where.`
            : `Ira read ${the(read)} and found the design supports this check.`;
        return {
          ...p,
          result: res,
          evidencedBy: Array.from(new Set([...(p.evidencedBy ?? []), ...onFile.map(doc => doc.id)])),
          workflowRunRef: `Ask IRA · checked · ${at}`,
          validation: { result: res, qa, summary, fileName: files.join(', ') || undefined, at },
        };
      });
      tally = { checks: points.length, failed, blocked, files };
      return { ...c, design: { ...d, points, ira: { by: me, at, evidenceChanged: false } } };
    });
    pushExec(() => {
      if (!tally) return null;
      const passed = tally.checks - tally.failed - tally.blocked;
      // The blocked ones are named in the log, not folded into the pass count.
      // "5 passed" on a run that could only read three is the sentence a
      // reviewer would later find was not true.
      const could = tally.blocked > 0 ? `, ${tally.blocked} it could not test` : '';
      return { controlId, track: 'design', kind: 'ai-review', verb: `ran Ira on ${tally.checks} design check${tally.checks === 1 ? '' : 's'} — ${passed} passed, ${tally.failed} failed${could}`, result: tally.failed > 0 ? 'Fail' : 'Pass' };
    });
    pushRun(prev => {
      const c = prev.controls.find(cc => cc.id === controlId);
      if (!c || !tally) return null;
      return {
        kind: 'ai-validation', label: `AI validation — ${c.wpRef} · ${tally.checks} design check${tally.checks === 1 ? '' : 's'}`,
        detail: `Ira read ${tally.files.length} file${tally.files.length === 1 ? '' : 's'}: ${tally.files.join(', ')}`,
        controls: [{ controlId: c.id, wpRef: c.wpRef, description: c.description, outcome: tally.failed > 0 ? 'Ineffective' : 'Effective', checks: tally.checks }],
      };
    });
  }, [patchControl, pushExec, pushRun, me, role]);

  const validateReadyAttributes = useCallback<IcfrCtx['validateReadyAttributes']>((controlId) => {
    if (role !== 'auditor' || awaitingDesignApproval(controlId)) return;
    let codes: string[] = [];
    patchControl(controlId, c => {
      codes = c.operating.steps.filter(s => requiredFilesReady(s, c)).map(s => s.code);
      if (!codes.length) return c;
      return { ...c, operating: { ...c.operating, steps: c.operating.steps.map(s => (requiredFilesReady(s, c) ? validatedStep(s, c, controlId) : s)) } };
    });
    pushExec(prev => {
      if (!codes.length) return null;
      const steps = prev.controls.find(cc => cc.id === controlId)?.operating.steps.filter(s => codes.includes(s.code)) ?? [];
      return { controlId, track: 'operating', kind: 'validate', verb: 'ran AI validation on the ready attributes', target: codes.join(', '), result: steps.some(s => s.result === 'Fail') ? 'Fail' : 'Pass' };
    });
    pushRun(prev => {
      const c = prev.controls.find(cc => cc.id === controlId);
      if (!c || !codes.length) return null;
      return {
        kind: 'ai-validation', label: `AI validation — ${c.wpRef} · ${codes.length} attribute${codes.length === 1 ? '' : 's'}`,
        detail: `Ran on ${codes.join(', ')} — every required file uploaded`,
        controls: [controlOutcome(c)],
      };
    });
  }, [patchControl, pushExec, pushRun, role, awaitingDesignApproval]);

  // The list itself. Editing writes the whole list onto the attribute, so the
  // split read off its wording stops applying the moment anyone changes it.
  // An attribute is the auditor's to write (see addAttribute), and so is the
  // evidence it is proven against.
  const editRequiredFiles = useCallback((controlId: string, stepId: string, fn: (list: RequiredFile[]) => RequiredFile[]) => {
    if (role !== 'auditor') return;
    patchStep(controlId, stepId, (s, c) => ({ ...s, requiredFiles: fn(requiredFilesOf(s, c)) }));
  }, [patchStep, role]);
  const addRequiredFile = useCallback<IcfrCtx['addRequiredFile']>((controlId, stepId, label) => {
    const l = label.trim();
    if (!l) return;
    editRequiredFiles(controlId, stepId, list => [...list, { id: uid('rf'), label: l }]);
  }, [editRequiredFiles]);
  const renameRequiredFile = useCallback<IcfrCtx['renameRequiredFile']>((controlId, stepId, fileId, label) => {
    const l = label.trim();
    if (!l) return;
    editRequiredFiles(controlId, stepId, list => list.map(f => (f.id === fileId ? { ...f, label: l } : f)));
  }, [editRequiredFiles]);
  const removeRequiredFile = useCallback<IcfrCtx['removeRequiredFile']>((controlId, stepId, fileId) => {
    editRequiredFiles(controlId, stepId, list => list.filter(f => f.id !== fileId));
  }, [editRequiredFiles]);
  const uploadRequiredFile = useCallback<IcfrCtx['uploadRequiredFile']>((controlId, stepId, fileId, fileName) => {
    const kind: EvidenceFile['kind'] = /\.xlsx?$/i.test(fileName) ? 'XLSX' : /\.csv$/i.test(fileName) ? 'CSV' : /\.(png|jpe?g)$/i.test(fileName) ? 'IMG' : 'PDF';
    editRequiredFiles(controlId, stepId, list => list.map(f => (f.id === fileId ? { ...f, file: { id: uid('f'), name: fileName, kind, uploadedBy: me, uploadedAt: 'just now' } } : f)));
  }, [editRequiredFiles, me]);
  const clearRequiredFile = useCallback<IcfrCtx['clearRequiredFile']>((controlId, stepId, fileId) => {
    editRequiredFiles(controlId, stepId, list => list.map(f => (f.id === fileId ? { id: f.id, label: f.label } : f)));
  }, [editRequiredFiles]);
  const testAllAttributes = useCallback<IcfrCtx['testAllAttributes']>((controlId) => {
    if (role !== 'auditor' || awaitingDesignApproval(controlId)) return;
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, steps: c.operating.steps.map(s => {
      const fail = s.result === 'Fail' || s.override?.result === 'Fail';
      const res: TestResult = fail ? 'Fail' : 'Pass';
      const wantsValidation = s.aiValidation || s.evidenceMode === 'ai' || !!s.inputFile;
      return stampSamples(c, {
        ...s, result: res, staleRun: undefined,
        workflowRunRef: s.workflowName ? (s.workflowRunRef ?? `${wfRunRef(controlId + s.id, fail)} · just now`) : s.workflowRunRef,
        validation: wantsValidation ? (s.validation ?? { result: res, qa: validationQA(s.description, fail), summary: validationSummary(c, s, fail, controlId + s.id), table: validationTable(c, s, fail, controlId + s.id), fileName: s.inputFile?.name, at: 'just now' }) : s.validation,
      }, res);
    }) } }));
    pushExec(prev => { const steps = prev.controls.find(cc => cc.id === controlId)?.operating.steps; return steps && steps.length ? { controlId, track: 'operating', kind: 'test-all', verb: 'tested all attributes', target: `${steps.length} attribute${steps.length === 1 ? '' : 's'}`, result: steps.some(s => s.result === 'Fail') ? 'Fail' : 'Pass' } : null; });
    pushRun(prev => {
      const c = prev.controls.find(cc => cc.id === controlId);
      if (!c || !c.operating.steps.length) return null;
      return {
        kind: 'control-test', label: `Control test — ${c.wpRef}`,
        detail: `${c.operating.steps.length} operating attribute${c.operating.steps.length === 1 ? '' : 's'} tested`,
        controls: [controlOutcome(c)],
      };
    });
  }, [patchControl, pushExec, pushRun, role, awaitingDesignApproval]);

  const concludeOperating = useCallback<IcfrCtx['concludeOperating']>((controlId, conclusion, rationale) => {
    // Clearing a TOE conclusion is a way back out, so only concluding waits on TOD.
    if (role !== 'auditor' || (conclusion !== 'Not tested' && awaitingDesignApproval(controlId))) return;
    // re-concluding clears a reviewer's return note — the rework happened
    patchControl(controlId, c => {
      // A stale run cannot be concluded on: it was testing a draw that no
      // longer exists. Re-run (or re-attest) the flagged attributes first.
      if (conclusion !== 'Not tested' && c.operating.steps.some(s => s.staleRun)) return c;
      // Nor can a statement nobody backed. An attribute whose only support is
      // somebody saying so has not been tested, and a control cannot be called
      // effective on the strength of it.
      //
      // Effective only. Ineffective stays open on purpose: if the account you
      // were given says the control did not run, that is a conclusion you can
      // defend, and refusing it would trap the control with no way out.
      if (conclusion === 'Effective' && inquiryOnlyAttributes(c).length) return c;
      // Nor can a track with a failed attribute be called effective. Nothing
      // stopped this before; it matters now, because a second-round failure
      // raises its deficiency the moment it is recorded — and a control carrying
      // an open deficiency while reading Effective is the file contradicting
      // itself. Extend the sample, redraw with a reason, or conclude the
      // failure.
      if (conclusion === 'Effective' && toeRoundFailed(c)) return c;
      // Nor on an attribute nobody has tested. Any route counts — AI
      // validation, a manual result, an attestation or an override — but an
      // attribute with no result at all has not been shown to operate.
      if (conclusion === 'Effective' && c.operating.steps.some(s => stepResult(s) === 'Not tested')) return c;
      // Nor on a Pass the files don't back (17 Sep) — every passing attribute
      // needs its required files in.
      if (conclusion === 'Effective' && passedWithoutFiles(c).length) return c;
      return { ...c, reviewReturn: conclusion === 'Not tested' ? c.reviewReturn : undefined, operating: { ...c.operating, conclusion, rationale: conclusion === 'Not tested' ? undefined : (rationale?.trim() || c.operating.rationale), testedBy: me, testedAt: 'just now' } };
    });
    // Reads the state the patch produced: a stale-run refusal above leaves the
    // conclusion unwritten, and an event for a conclusion that never landed
    // would be the log lying. raiseDeficiencyIfIneffective checks the live
    // track itself, so the refusal makes it a no-op too.
    if (conclusion !== 'Not tested') pushExec(prev => {
      const cc = prev.controls.find(x => x.id === controlId);
      if (cc?.operating.conclusion !== conclusion) return null;
      return { controlId, track: 'operating', kind: 'conclude', verb: `concluded operating ${conclusion.toLowerCase()}`, result: conclusion };
    });
    if (conclusion === 'Ineffective') raiseDeficiencyIfIneffective(controlId, 'operating');
  }, [patchControl, me, role, pushExec, raiseDeficiencyIfIneffective, awaitingDesignApproval]);

  /**
   * Set the failed round aside and reopen the draw.
   *
   * Everything the round proved is kept whole — the items, the per-attribute
   * results, the verdicts — and filed under `rounds` with the reason it was set
   * aside, the person and the time. The working paper prints all of it; a round
   * that leaves no trace is a round that was hidden.
   *
   * What clears is only what the next round has to answer for itself: the draw,
   * the per-item results, each attribute's verdict, and any override made about
   * the old evidence. Attestations and validations are left standing — they are
   * statements about the control, not about the items — but their result is gone
   * with the verdict, so nothing carries forward untested.
   */
  const startToeRound = useCallback<IcfrCtx['startToeRound']>((controlId, reason) => {
    if (role !== 'auditor' || awaitingDesignApproval(controlId)) return;
    const why = reason.trim();
    if (!why) return;
    patchControl(controlId, c => {
      if (!canRedrawToe(c)) return c;
      const samp = c.operating.sampling;
      if (!samp) return c;
      const results: Record<string, Record<string, TestResult>> = {};
      const stepResults: Record<string, TestResult> = {};
      c.operating.steps.forEach(s => {
        if (s.sampleResults) results[s.id] = { ...s.sampleResults };
        stepResults[s.id] = stepResult(s);
      });
      const closed: ToeRound = {
        n: toeRoundNo(c),
        sampling: structuredClone(samp),
        results,
        stepResults,
        outcome: Object.values(stepResults).includes('Fail') ? 'Fail' : 'Pass',
        setAside: { reason: why, by: me, at: 'just now' },
      };
      const pop = c.operating.population;
      return {
        ...c,
        operating: {
          ...c.operating,
          rounds: [...toeRounds(c), closed],
          sampling: undefined,
          exceptions: [],
          // Each file goes back to its draw as well. Clearing the sample alone
          // left every source still marked as drawn, so step ③ had nothing left
          // to offer and the round that had just been opened could not be filled.
          // The population itself is untouched — it is the CRITERIA the auditor is
          // about to correct, on the file, not the file's own standing.
          population: pop ? { ...pop, sources: populationSources(c).map(s => ({ ...s, draw: undefined, approvedSample: undefined })) } : pop,
          steps: c.operating.steps.map(s => ({
            ...s, sampleResults: undefined, result: 'Not tested' as TestResult, override: undefined, staleRun: undefined,
          })),
        },
      };
    });
    pushExec(prev => {
      const cc = prev.controls.find(x => x.id === controlId);
      // The patch refuses on a spent control; an event for a round that never
      // opened would be the trail claiming work nobody did.
      if (!cc || toeRoundNo(cc) < 2) return null;
      return { controlId, track: 'operating', kind: 'sample', verb: `set round ${toeRoundNo(cc) - 1} aside and reopened the draw`, target: short(why, 80) };
    });
  }, [patchControl, pushExec, me, role, awaitingDesignApproval]);

  const overrideOperating = useCallback<IcfrCtx['overrideOperating']>((controlId, override) => {
    if (role !== 'auditor' || (override && awaitingDesignApproval(controlId))) return;
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, override: override ?? undefined } }));
    if (override) pushExec(() => ({ controlId, track: 'operating', kind: 'override', verb: 'overrode the operating conclusion', result: override.result === 'Effective' ? 'Effective' : 'Ineffective' }));
    if (override?.result === 'Ineffective') raiseDeficiencyIfIneffective(controlId, 'operating');
  }, [patchControl, role, pushExec, raiseDeficiencyIfIneffective, awaitingDesignApproval]);

  // ── RACM row review + bulk testing ────────────────────────────────────────────
  // Pre-testing review is the auditor's call and only while the engagement is
  // open — the same two checks every other mutation in this store makes. They
  // matter more here than most: these rows feed a reported completeness figure,
  // and a countersigned engagement's matrix must not move under the signature.
  // A concluded control's row is skipped as well as a sealed audit's: the matrix
  // describes what was tested, so it must not move under a signed conclusion.
  const approveRacmRows = useCallback<IcfrCtx['approveRacmRows']>((controlIds) => {
    if (role !== 'auditor') return;
    const ids = new Set(controlIds);
    setEng(prev => isEngagementLocked(prev) ? prev
      : { ...prev, controls: prev.controls.map(c => ids.has(c.id) && !isControlLocked(c) ? { ...c, racmReview: { status: 'Approved', by: me, at: 'just now' } as RacmReview } : c) });
  }, [me, role]);

  const remarkRacmRow = useCallback<IcfrCtx['remarkRacmRow']>((controlId, remark) => {
    if (role !== 'auditor') return;
    setEng(prev => isEngagementLocked(prev) ? prev
      : { ...prev, controls: prev.controls.map(c => c.id === controlId && !isControlLocked(c) ? { ...c, racmReview: { status: 'Remark', remark, by: me, at: 'just now' } as RacmReview } : c) });
  }, [me, role]);

  const clearRacmReview = useCallback<IcfrCtx['clearRacmReview']>((controlId) => {
    if (role !== 'auditor') return;
    setEng(prev => isEngagementLocked(prev) ? prev
      : { ...prev, controls: prev.controls.map(c => c.id === controlId && !isControlLocked(c) ? { ...c, racmReview: undefined } : c) });
  }, [role]);

  // Bulk test — for each selected control, validate every design consideration and
  // test every operating attribute (an existing Fail / overridden Fail stays Fail),
  // then conclude each track from its results. One trail entry per control.
  const bulkTestControls = useCallback<IcfrCtx['bulkTestControls']>((controlIds) => {
    if (role !== 'auditor') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      // concluded controls are frozen — a bulk run silently skips them
      const ids = new Set(controlIds.filter(id => {
        const c = prev.controls.find(x => x.id === id);
        return c && !isControlLocked(c);
      }));
      if (!ids.size) return prev;
      const execs: ExecutionEvent[] = [];
      const controls = prev.controls.map(c => {
        if (!ids.has(c.id)) return c;
        const points = c.design.points.map(p => {
          const willFail = (p.override ? p.override.result : p.result) === 'Fail';
          return { ...p, result: (willFail ? 'Fail' : 'Pass') as TestResult, override: undefined, workflowRunRef: 'run · validated · just now', validation: { qa: designCheckQA(p.text, willFail), at: 'just now' } };
        });
        const steps = c.operating.steps.map(s => {
          const fail = s.result === 'Fail' || s.override?.result === 'Fail';
          const res: TestResult = fail ? 'Fail' : 'Pass';
          const wantsValidation = s.aiValidation || s.evidenceMode === 'ai' || !!s.inputFile;
          return stampSamples(c, {
            ...s, result: res,
            workflowRunRef: s.workflowName ? (s.workflowRunRef ?? `${wfRunRef(seedKeyOf(c) + s.id, fail)} · just now`) : s.workflowRunRef,
            validation: wantsValidation ? (s.validation ?? { result: res, qa: validationQA(s.description, fail), summary: validationSummary(c, s, fail, seedKeyOf(c) + s.id), table: validationTable(c, s, fail, seedKeyOf(c) + s.id), fileName: s.inputFile?.name, at: 'just now' }) : s.validation,
          }, res);
        });
        const designConcl: TrackConclusion = points.some(p => p.result === 'Fail') ? 'Ineffective' : 'Effective';
        const opConcl: TrackConclusion = steps.some(s => s.result === 'Fail') ? 'Ineffective' : 'Effective';
        // Locked until approved (S6, A36): a design not yet approved is concluded
        // here and goes to the reviewer, and TOE is left for after. An approved
        // design is left alone and TOE is tested behind it — re-concluding the
        // design would pull the approval out from under those results.
        const approved = designApproved(c);
        // Year-end controls (A29): TOE waits for the year-end audit, so behind an
        // approved design in an interim or roll-forward there is nothing to run.
        const pending = !!yearEndPending(c, prev.audits.find(a => a.id === openAuditId));
        const dPoints = approved ? [] : points;
        const oSteps = approved && !pending ? steps : [];
        const checks = dPoints.length + oSteps.length;
        if (checks > 0) execs.push({
          id: uid('ex'), controlId: c.id, track: 'operating', kind: 'test-all', verb: approved ? 'bulk tested operating' : 'bulk tested design',
          target: `${checks} check${checks === 1 ? '' : 's'}`,
          result: (dPoints.length && designConcl === 'Ineffective') || (oSteps.length && opConcl === 'Ineffective') ? 'Ineffective' : 'Effective',
          by: me, role, at: 'just now',
        });
        return {
          ...c,
          design: dPoints.length ? { ...c.design, points: dPoints, conclusion: designConcl, override: undefined, testedBy: me, testedAt: 'just now', approval: { preparedBy: { by: me, at: 'just now' } }, designReturn: undefined } : c.design,
          operating: oSteps.length ? { ...c.operating, steps: oSteps, conclusion: opConcl, override: undefined, testedBy: me, testedAt: 'just now' } : c.operating,
        };
      });
      // one run record for the whole bulk run — the Runs tab's registry entry
      const tested = controls.filter(c => ids.has(c.id));
      const outcomes = tested.map(controlOutcome);
      const datasets = Array.from(new Set(tested.flatMap(c => requiredDatasetsFor(c).map(d => d.name))));
      const run: RunRecord = {
        id: uid('run'), kind: 'bulk-test',
        label: `Bulk test — ${outcomes.length} control${outcomes.length === 1 ? '' : 's'}`,
        detail: `${outcomes.reduce((n, o) => n + o.checks, 0)} checks · ${datasets.length} dataset${datasets.length === 1 ? '' : 's'}`,
        controls: outcomes, datasets, by: me, role, at: 'just now',
      };
      return { ...prev, controls, executions: [...execs, ...prev.executions], runs: [run, ...prev.runs] };
    });
    // a bulk run can conclude tracks ineffective — raise their exceptions too
    controlIds.forEach(id => {
      raiseDeficiencyIfIneffective(id, 'design');
      raiseDeficiencyIfIneffective(id, 'operating');
    });
  }, [me, role, raiseDeficiencyIfIneffective, openAuditId]);

  const addRacmDoc = useCallback<IcfrCtx['addRacmDoc']>((fileName, process, opts) => {
    const lower = fileName.toLowerCase();
    const kind: EvidenceFile['kind'] = lower.endsWith('.csv') ? 'CSV' : lower.endsWith('.xlsx') || lower.endsWith('.xls') ? 'XLSX' : lower.endsWith('.png') || lower.endsWith('.jpg') ? 'IMG' : 'PDF';
    setRacmDocs(prev => [{ id: uid('rd'), name: fileName, kind, uploadedBy: me, uploadedAt: 'just now', process, ...(opts?.source ? { source: opts.source } : {}), ...(opts?.url ? { url: opts.url } : {}) }, ...prev]);
  }, [me]);

  // Creating a RACM brings a process into scope: the template seeds its risks
  // and controls (the same primitive reconcileScope uses for newly-scoped
  // processes), and the workbook / SOP that produced it is pinned to the new
  // matrix as its source document. A process that already has a RACM is a
  // no-op — the landing lists one RACM per process.
  const createRacm = useCallback<IcfrCtx['createRacm']>((process, sourceFileName, entity, opts) => {
    if (role !== 'auditor') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      if (prev.controls.some(c => c.process === process)) return prev;
      // The company the matrix belongs to, stamped on every control it creates:
      // a group audit tests the same process separately at each entity, and a
      // row that cannot say which company it is for cannot be concluded.
      //
      // Its two owners come off the same shelf. The scoping wizard already asked
      // who runs this process and who is accountable for it; a RACM uploaded
      // afterwards used to land with neither, so every control it made arrived
      // with a template name on it and nobody real to ask for evidence.
      const people = peopleForProcess(process);
      // Controls read out of the file keep the owners the file names; only a
      // blank one falls back to the process's people, then the template does.
      const imported = opts?.controls;
      const taken = new Set(prev.controls.map(c => c.id));
      const rows = (imported ?? racmTemplateForProcesses([process], 'fresh'))
        .map(c => {
          // A file's control IDs are the client's own numbering and can repeat
          // one already on the engagement. The row keeps that number as its
          // `code` and takes a unique id, the same convention entity copies use.
          let id = c.id;
          if (imported && taken.has(id)) { let n = 2; while (taken.has(`${c.id}-${n}`)) n++; id = `${c.id}-${n}`; }
          taken.add(id);
          return {
            ...c,
            id,
            ...(id !== c.id ? { code: c.code ?? c.id } : {}),
            process,
            ...(entity ? { entity } : {}),
            ...(imported
              ? { owner: c.owner || people?.controlOwner || c.owner, processOwner: c.processOwner || people?.processOwner }
              : people ? { owner: people.controlOwner, processOwner: people.processOwner } : {}),
          };
        });
      return { ...prev, controls: [...prev.controls, ...rows] };
    });
    if (sourceFileName) addRacmDoc(sourceFileName, process, { source: opts?.source, url: opts?.url });
  }, [role, addRacmDoc]);

  // Copy RACMs in from the RACM tab (S11). The engagement keeps its copy — later
  // edits on the tab never reach it — and the tab records it as a user, which is
  // what blocks deleting the source. An ID that would repeat one already here, or
  // one between the RACMs picked, refuses the whole add: the picker says which.
  const addLibraryRacms = useCallback<IcfrCtx['addLibraryRacms']>((racmIds) => {
    if (role !== 'auditor' || isEngagementLocked(eng)) return 0;
    const racms = racmIds.map(findLibraryRacm).filter((r): r is NonNullable<typeof r> => !!r);
    if (!racms.length) return 0;
    const clashes = controlIdClashes([{ name: 'this engagement', controls: eng.controls }, ...racms.map(r => ({ name: r.name, controls: r.controls }))]);
    if (clashes.length) return 0;
    const copies = racms.flatMap(copyRacmControls);
    setEng(prev => ({ ...prev, controls: [...prev.controls, ...copies] }));
    markRacmsUsed(racms.map(r => r.id), { id: eng.id, name: eng.name });
    // Keep the record in step, so the engagement still names its RACMs after a
    // remount. Controls persist only on engagements created from the tab — a
    // seeded engagement rebuilds its register from its seed.
    const record = findEngagement(eng.id);
    if (record) registerEngagement({
      ...record,
      soxRacms: [...(record.soxRacms ?? []), ...racms.map(r => ({ racmId: r.id, name: r.name }))],
      ...(record.soxControls ? { soxControls: [...record.soxControls, ...copies] } : {}),
    });
    return copies.length;
  }, [role, eng]);

  // Deleting a RACM takes its controls with it, so it is refused the moment an
  // audit covers any of them — testing, findings and sign-offs hang off those
  // controls. The RACM tab says why before the button is ever pressed.
  const deleteRacm = useCallback<IcfrCtx['deleteRacm']>((process) => {
    if (role !== 'auditor') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      if (racmAuditUse(prev, process).audits.length) return prev;
      return { ...prev, controls: prev.controls.filter(c => c.process !== process) };
    });
    setRacmDocs(prev => prev.filter(d => d.process !== process));
  }, [role]);

  // ── discussions ───────────────────────────────────────────────────────────────
  const addComment = useCallback<IcfrCtx['addComment']>((controlId, anchor, text) => {
    setEng(prev => {
      const existing = prev.discussions.find(d => d.controlId === controlId && d.anchor === anchor);
      const comment = { id: `cm-${prev.discussions.reduce((n, d) => n + d.comments.length, 0) + 1}`, by: me, role, at: 'just now', text };
      if (existing) {
        return { ...prev, discussions: prev.discussions.map(d => d.id === existing.id ? { ...d, resolved: false, comments: [...d.comments, comment] } : d) };
      }
      return { ...prev, discussions: [...prev.discussions, { id: `disc-${prev.discussions.length + 1}`, controlId, anchor, resolved: false, comments: [comment] }] };
    });
  }, [me, role]);

  const resolveDiscussion = useCallback<IcfrCtx['resolveDiscussion']>((discussionId, resolved) => {
    setEng(prev => ({ ...prev, discussions: prev.discussions.map(d => d.id === discussionId ? { ...d, resolved } : d) }));
  }, []);

  // ── handoffs ──────────────────────────────────────────────────────────────────
  const submitTask = useCallback<IcfrCtx['submitTask']>((taskId) => {
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const task = prev.tasks.find(t => t.id === taskId);
      let controls = prev.controls;
      // a submitted PBC marks the requested design documents received — unless the
      // control has since concluded, in which case its paper is frozen. The task
      // still clears: the owner did what was asked, and leaving it open would chase
      // them for a control nobody is testing any more.
      if (task && task.type === 'pbc') {
        controls = prev.controls.map(c => c.id === task.controlId && !isControlLocked(c)
          ? { ...c, design: { ...c.design, documents: c.design.documents.map(d => d.status === 'Requested' ? { ...d, status: 'Received' as DocStatus, uploadedBy: task.assignee, at: 'just now' } : d) } }
          : c);
      }
      return { ...prev, controls, tasks: prev.tasks.map(t => t.id === taskId ? { ...t, status: 'cleared' } : t) };
    });
  }, []);

  const clearTask = useCallback<IcfrCtx['clearTask']>((taskId) => {
    setEng(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === taskId ? { ...t, status: 'cleared' } : t) }));
  }, []);

  const raiseQuery = useCallback<IcfrCtx['raiseQuery']>((controlId, title, detail) => {
    setEng(prev => ({ ...prev, tasks: [...prev.tasks, { id: `Q-${prev.tasks.length + 1}`, type: 'query', controlId, title, detail, assignee: 'Risk Owner', assigneeRole: 'risk-owner', raisedBy: me, dueLabel: 'Open', overdue: false, status: 'open' }] }));
  }, [me]);

  const requestDesignDocs = useCallback<IcfrCtx['requestDesignDocs']>((controlIds) => {
    if (role !== 'auditor') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const ids = new Set(controlIds);
      const newTasks: HandoffTask[] = [];
      const newExecs: ExecutionEvent[] = [];
      const controls = prev.controls.map(c => {
        // A concluded control is not chased for documents — its testing is done,
        // and a request would reopen a conversation the paper has closed.
        if (!ids.has(c.id) || isControlLocked(c)) return c;
        // A waived element is not chased: the audit team wrote it, the client
        // holds it, or there is nothing to hold. Asking for it anyway is noise.
        const missing = c.design.documents.filter(d => d.status === 'Missing' && !d.waiver);
        if (missing.length) {
          // Evidence is asked of whoever runs the process, not whoever answers for it.
          newTasks.push({ id: `PBC-${prev.tasks.length + newTasks.length + 1}`, type: 'pbc', controlId: c.id, title: `Provide design documents (${missing.length})`, detail: `Needed for TOD: ${missing.map(d => d.kind).join(', ')}.`, assignee: ownersOf(c).processOwner, assigneeRole: 'risk-owner', raisedBy: me, dueLabel: 'Due in 3d', overdue: false, status: 'open' });
          newExecs.push({ id: uid('ex'), controlId: c.id, track: 'design', kind: 'request-docs', verb: `requested ${missing.length} design document${missing.length === 1 ? '' : 's'}`, by: me, role, at: 'just now' });
        }
        return { ...c, design: { ...c.design, documents: c.design.documents.map(d => d.status === 'Missing' && !d.waiver ? { ...d, status: 'Requested' as DocStatus } : d) } };
      });
      return { ...prev, controls, tasks: [...prev.tasks, ...newTasks], executions: [...newExecs, ...prev.executions] };
    });
  }, [me, role]);

  // Evaluation is the auditor's lane — the owner never grades their own exception.
  // Any edit that MOVES the grade writes its own trail entry: the rule is that a
  // severity never changes without the record saying what it was, what it became
  // and who touched it. A confirmed rating that moves loses its confirmation —
  // the reviewer agreed to a number, not to a field.
  const updateDeficiency = useCallback<IcfrCtx['updateDeficiency']>((id, patch) => {
    if (role !== 'auditor') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const before = prev.deficiencies.find(d => d.id === id);
      if (!before) return prev;
      if (ownsIt(prev, before.controlId, me)) return prev;
      const after: Deficiency = { ...before, ...patch };
      // Ira's tag comes off a field the moment that field changes (S9, A31): a
      // tag left on a figure the auditor chose would credit Ira with their call.
      // A patch that sets the tags itself ("Use this" on Ira's root cause) is
      // taken as written.
      if (before.iraSuggested && !('iraSuggested' in patch)) {
        const tags = { ...before.iraSuggested };
        (['likelihood', 'magnitude', 'compensatingControlId', 'rootCause'] as const).forEach(k => { if (k in patch && patch[k] !== before[k]) delete tags[k]; });
        after.iraSuggested = Object.keys(tags).length ? tags : undefined;
      }
      const next = { ...prev, deficiencies: prev.deficiencies.map(d => (d.id === id ? after : d)) };
      const g0 = gradeException(before, prev).grade;
      const g1 = gradeException(after, next).grade;
      if (g0 === g1) return next;
      const event: ExecutionEvent = {
        id: uid('ex'), controlId: before.controlId, track: before.track, kind: 'exception',
        verb: `re-graded ${id}`, from: g0, to: g1, by: me, role, at: 'just now',
        rationale: 'Severity inputs changed — the engine recomputed.',
      };
      // A grade that has moved is no longer the one the reviewer confirmed —
      // whichever WAY it moved. Clearing only on the way up let a confirmed
      // material weakness be walked down past the reviewer with their stamp
      // still attached, which is the one thing this rung exists to stop.
      //
      // Swept across EVERY exception, not just this one: one member's figures
      // move its whole group, and a sibling whose grade the group has just
      // raised is carrying a confirmation for a grade that no longer stands.
      return reconcileConfirmations({ ...next, executions: [event, ...next.executions] });
    });
  }, [me, role]);

  /* ── Root-cause groups ──────────────────────────────────────────────────────
   *
   * The one grouping a person makes. Membership lives on the group so it can
   * only ever be symmetric — the old single `rootCauseLinkId` could point one
   * way and leave the other exception not knowing it had been linked.
   */
  const linkRootCause = useCallback<IcfrCtx['linkRootCause']>((id, target) => {
    if (role !== 'auditor') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const groups = prev.rootCauseGroups ?? [];
      let next: IcfrEngagement;
      if ('groupId' in target) {
        if (!groups.some(g => g.id === target.groupId)) return prev;
        next = { ...prev, rootCauseGroups: groups.map(g => (g.id === target.groupId && !g.memberIds.includes(id) ? { ...g, memberIds: [...g.memberIds, id] } : g)) };
      } else {
        const name = target.name.trim();
        if (!name) return prev;
        // A new group starts with both ends of the link in it — a root-cause
        // group of one says nothing about a shared mechanism.
        const members = Array.from(new Set([id, ...target.withIds]));
        next = { ...prev, rootCauseGroups: [...groups, { id: uid('rcg'), name, memberIds: members, by: me, at: 'just now' }] };
      }
      return reconcileConfirmations(next);
    });
  }, [me, role]);

  const unlinkRootCause = useCallback<IcfrCtx['unlinkRootCause']>((id, groupId) => {
    if (role !== 'auditor') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      // A group that empties out to one member is not a group any more.
      const groups = (prev.rootCauseGroups ?? [])
        .map(g => (g.id === groupId ? { ...g, memberIds: g.memberIds.filter(m => m !== id) } : g))
        .filter(g => g.memberIds.length > 1);
      return reconcileConfirmations({ ...prev, rootCauseGroups: groups });
    });
  }, [role]);

  /** "These members do not compound, and here is why."
   *
   *  Deliberately NOT a way to break a derived group up: two exceptions hitting
   *  Accounts Payable is a fact, and an auditor who judges they do not compound
   *  is making an argument, not correcting a record. So the argument is filed
   *  and the combined grade stands beside it. */
  const setGroupConclusion = useCallback<IcfrCtx['setGroupConclusion']>((groupKey, note) => {
    if (role !== 'auditor') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const rest = (prev.groupConclusions ?? []).filter(c => c.groupKey !== groupKey);
      const text = note.trim();
      return { ...prev, groupConclusions: text ? [...rest, { groupKey, note: text, by: me, at: 'just now' }] : rest };
    });
  }, [me, role]);

  // ─── Step 2 → 3 · the rating leaves the auditor's hands ───────────────────────
  // Every grade parks for the reviewer before the owner is asked to plan anything:
  // a wrong rating must not set weeks of remediation running, and it is cheaper to
  // argue about the grade than to undo a fix built on it. A finding called small is
  // as much a judgement as one called a material weakness — the reviewer sees both.
  const completeSizing = useCallback<IcfrCtx['completeSizing']>((id) => {
    if (role !== 'auditor') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const target = prev.deficiencies.find(d => d.id === id);
      if (!target || target.status !== 'Identified') return prev;
      if (ownsIt(prev, target.controlId, me)) return prev;
      if (!rootCauseReady(target)) return prev;               // step 1 is not done — unwritten, or Ira's draft unchecked
      const grade = gradeException(target, prev).grade;
      // A confirmation already standing (a re-size after the reviewer sent it
      // back on something other than the grade) is not asked for twice.
      const next: ExceptionStatus = !target.ratingConfirm ? 'Rating review' : 'Planning';
      const event: ExecutionEvent = {
        id: uid('ex'), controlId: target.controlId, track: target.track, kind: 'exception',
        verb: next === 'Rating review' ? `sent ${id} for rating confirmation` : `handed ${id} to ${target.remediation.owner} to plan`,
        from: 'Identified', to: next, result: undefined, by: me, role, at: 'just now',
        rationale: `Graded ${grade}.`,
      };
      return {
        ...prev,
        deficiencies: prev.deficiencies.map(d => (d.id === id
          ? { ...d, status: next, ratingReturn: undefined, sized: { by: me, at: 'just now' } } : d)),
        executions: [event, ...prev.executions],
      };
    });
  }, [me, role]);

  // The reviewer agrees the grade, or sends it back with a reason. Nothing else
  // can happen to the exception in between — that is what "blocking" means.
  const confirmRating = useCallback<IcfrCtx['confirmRating']>((id) => {
    if (role !== 'reviewer') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const target = prev.deficiencies.find(d => d.id === id);
      if (!target || target.status !== 'Rating review') return prev;
      if (ownsIt(prev, target.controlId, me)) return prev;
      if (samePerson(target.sized, me)) return prev;   // agreeing with your own rating is not a review
      const grade = gradeException(target, prev).grade;
      const event: ExecutionEvent = {
        id: uid('ex'), controlId: target.controlId, track: target.track, kind: 'exception',
        verb: `confirmed ${id} as ${grade}`, from: 'Rating review', to: 'Planning', by: me, role, at: 'just now',
      };
      return {
        ...prev,
        deficiencies: prev.deficiencies.map(d => (d.id === id
          ? { ...d, ratingConfirm: { grade, by: me, at: 'just now' }, status: 'Planning' as const } : d)),
        executions: [event, ...prev.executions],
      };
    });
  }, [me, role]);

  const returnRating = useCallback<IcfrCtx['returnRating']>((id, reason) => {
    if (role !== 'reviewer' || !reason.trim()) return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const target = prev.deficiencies.find(d => d.id === id);
      if (!target || target.status !== 'Rating review') return prev;
      if (ownsIt(prev, target.controlId, me)) return prev;
      const event: ExecutionEvent = {
        id: uid('ex'), controlId: target.controlId, track: target.track, kind: 'exception',
        verb: `sent ${id} back to the auditor`, from: 'Rating review', to: 'Identified',
        rationale: reason.trim(), by: me, role, at: 'just now',
      };
      return {
        ...prev,
        deficiencies: prev.deficiencies.map(d => (d.id === id
          ? { ...d, status: 'Identified' as const, ratingReturn: { reason: reason.trim(), by: me, at: 'just now' } } : d)),
        executions: [event, ...prev.executions],
      };
    });
  }, [me, role]);

  // ─── Step 3 · the plan, and the auditor's one say in it ───────────────────────
  // The auditor judges the plan against the root cause and nothing else. They do
  // not write it, do not execute it, and cannot edit it — a rejection carries a
  // reason back to the owner, who rewrites it.
  const submitPlan = useCallback<IcfrCtx['submitPlan']>((id) => {
    if (role !== 'risk-owner') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const target = prev.deficiencies.find(d => d.id === id);
      if (!target || target.status !== 'Planning') return prev;
      if (!ownsIt(prev, target.controlId, meOwner)) return prev;         // your control, your commitment
      const r = target.remediation;
      if (!r.action.trim() || !r.owner.trim() || !r.date) return prev;   // all three, or it is not a plan
      const event: ExecutionEvent = {
        id: uid('ex'), controlId: target.controlId, track: target.track, kind: 'exception',
        verb: `submitted the plan for ${id}`, from: 'Planning', to: 'Plan review', by: me, role, at: 'just now',
        rationale: short(r.action, 120),
      };
      return {
        ...prev,
        deficiencies: prev.deficiencies.map(d => (d.id === id
          ? { ...d, status: 'Plan review' as const, planSubmitted: { by: me, at: 'just now' }, planReview: undefined } : d)),
        executions: [event, ...prev.executions],
      };
    });
  }, [me, role]);

  const reviewPlan = useCallback<IcfrCtx['reviewPlan']>((id, decision, reason) => {
    if (role !== 'auditor') return;
    if (decision === 'Rejected' && !reason?.trim()) return;             // no silent rejections
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const target = prev.deficiencies.find(d => d.id === id);
      if (!target || target.status !== 'Plan review') return prev;
      if (ownsIt(prev, target.controlId, me)) return prev;
      if (samePerson(target.planSubmitted, me)) return prev;   // you do not judge your own plan
      const to: ExceptionStatus = decision === 'Accepted' ? 'Remediation' : 'Planning';
      const event: ExecutionEvent = {
        id: uid('ex'), controlId: target.controlId, track: target.track, kind: 'exception',
        verb: decision === 'Accepted' ? `accepted the plan for ${id}` : `rejected the plan for ${id}`,
        from: 'Plan review', to, rationale: reason?.trim(), by: me, role, at: 'just now',
      };
      return {
        ...prev,
        deficiencies: prev.deficiencies.map(d => (d.id === id
          ? {
            ...d, status: to,
            planReview: { decision, reason: reason?.trim(), by: me, at: 'just now' },
            remediation: { ...d.remediation, status: decision === 'Accepted' ? 'In progress' as const : 'Open' as const },
          } : d)),
        executions: [event, ...prev.executions],
      };
    });
  }, [me, role]);
  // The ground rules are the auditor's to set — everyone else reads them (at most).
  const updateRules = useCallback<IcfrCtx['updateRules']>((patch) => {
    if (role !== 'auditor') return;
    setEng(prev => isEngagementLocked(prev) ? prev : ({ ...prev, rules: { ...prev.rules, ...patch } }));
  }, [role]);
  const updateMateriality = useCallback<IcfrCtx['updateMateriality']>((patch) => {
    if (role !== 'auditor') return;
    setEng(prev => isEngagementLocked(prev) ? prev : ({ ...prev, ...patch }));
  }, [role]);
  /**
   * Bring the register into line with a new scope: park the processes that left
   * it, bring back any that have come home, seed shells for the genuinely new.
   *
   * Everything a control carries goes WITH it. Seven record types point at a
   * control id, and moving the control while leaving them behind is worse than
   * the move itself: Deficiency management shows a finding whose control cannot
   * be opened, the reviewer queue holds a note nobody can answer, and the
   * Dashboard counts work against controls that are not in the audit. That is
   * not a scope change, it is a broken screen.
   *
   * Parked, not deleted (Aug 2026). This used to filter the seven arrays and
   * drop what fell out, so narrowing scope after testing had started destroyed
   * the testing — and re-widening handed back an empty shell, because the fresh
   * template was the only thing left to build from. Scope moves both ways and
   * often by accident, so what leaves goes to `scopeArchive` whole and comes
   * back untouched. Same promise roll forward makes at year end.
   *
   * What deliberately does NOT get pruned: an audit's `archive`. A prior-year
   * snapshot is a record of what was concluded then, and this cycle's scope has
   * no business editing it.
   */
  const reconcileScope = useCallback<IcfrCtx['reconcileScope']>((processes) => {
    // Re-deriving the register is a config act, so it answers to the same two
    // questions every other config mutator does: whose hand is this, and is the
    // engagement still open? Neither was asked before — this was the one place a
    // signed-off engagement could still be rearranged, by anybody.
    if (role !== 'auditor') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const want = new Set(processes);
      const have = new Set(prev.controls.map(c => c.process));
      const kept = prev.controls.filter(c => want.has(c.process));
      const parked = prev.scopeArchive ?? [];

      // ── what comes home ──────────────────────────────────────────────────
      // A process back in scope is restored from the archive before anything is
      // templated for it: the work it left with is the whole reason it was kept.
      const returning = parked.flatMap(e => e.controls.filter(c => want.has(c.process)));
      const returningIds = new Set(returning.map(c => c.id));
      const stillParked = parked
        .map(e => ({
          ...e,
          processes: e.processes.filter(p => !want.has(p)),
          controls: e.controls.filter(c => !want.has(c.process)),
          deficiencies: e.deficiencies.filter(d => !returningIds.has(d.controlId)),
          tasks: e.tasks.filter(t => !returningIds.has(t.controlId)),
          discussions: e.discussions.filter(d => !returningIds.has(d.controlId)),
          reviewNotes: e.reviewNotes.filter(n => !returningIds.has(n.controlId)),
          executions: e.executions.filter(x => !returningIds.has(x.controlId)),
          runs: e.runs.map(r => ({ ...r, entries: r.entries.filter(rc => !returningIds.has(rc.controlId)) })).filter(r => r.entries.length > 0),
          auditControlIds: Object.fromEntries(
            Object.entries(e.auditControlIds ?? {})
              .map(([auditId, ids]) => [auditId, ids.filter(id => !returningIds.has(id))])
              .filter(([, ids]) => (ids as string[]).length > 0)),
        }))
        .filter(e => e.controls.length > 0);
      // Only what nothing can be restored for is genuinely new.
      const restoredProcesses = new Set(returning.map(c => c.process));
      const missing = processes.filter(p => !have.has(p) && !restoredProcesses.has(p));
      // Newly-scoped processes join the audit that scoped them, so their controls
      // carry its company — same stamp createRacm applies. Read off the register
      // rather than assumed, so a group audit doesn't get the wrong one.
      const entity = kept[0]?.entity ?? prev.controls[0]?.entity ?? prev.entity;
      const fresh = racmTemplateForProcesses(missing, 'fresh').map(c => (entity ? { ...c, entity } : c));
      const controls = [...kept, ...returning, ...fresh];

      // What the returning controls brought back with them.
      const back = parked.filter(e => e.controls.some(c => want.has(c.process)));
      const runsBack = back.flatMap(e => e.runs.map(r => ({ ...r, entries: r.entries.filter(rc => returningIds.has(rc.controlId)) })).filter(r => r.entries.length > 0));
      const restored = {
        deficiencies: back.flatMap(e => e.deficiencies.filter(d => returningIds.has(d.controlId))),
        tasks: back.flatMap(e => e.tasks.filter(t => returningIds.has(t.controlId))),
        discussions: back.flatMap(e => e.discussions.filter(d => returningIds.has(d.controlId))),
        reviewNotes: back.flatMap(e => e.reviewNotes.filter(n => returningIds.has(n.controlId))),
        executions: back.flatMap(e => e.executions.filter(x => returningIds.has(x.controlId))),
      };
      // A run row goes back into the run it came from if that run survived, and
      // the whole run is restored if it did not — either way the work reads the
      // same way it did before the scope moved. Merged by run id first: a run
      // split across two narrowings has a row in each archive entry, and taking
      // the last one would drop the other.
      const byRunId = new Map<string, { run: RunRecord; entries: RunControlOutcome[] }>();
      runsBack.forEach(r => {
        const held = byRunId.get(r.run.id);
        if (held) held.entries.push(...r.entries);
        else byRunId.set(r.run.id, { run: r.run, entries: [...r.entries] });
      });
      let runs = prev.runs.map(r => (byRunId.has(r.id) ? { ...r, controls: [...r.controls, ...byRunId.get(r.id)!.entries] } : r));
      const liveRunIds = new Set(prev.runs.map(r => r.id));
      runs = [...Array.from(byRunId.values()).filter(r => !liveRunIds.has(r.run.id)).map(r => ({ ...r.run, controls: r.entries })), ...runs];
      // Hand-picked audits get their restored controls named again.
      const audits = back.length
        ? prev.audits.map(a => {
          if (!a.controlIds) return a;
          const returned = back.flatMap(e => (e.auditControlIds?.[a.id] ?? []).filter(id => returningIds.has(id)));
          return returned.length ? { ...a, controlIds: Array.from(new Set([...a.controlIds, ...returned])) } : a;
        })
        : prev.audits;

      // ── what leaves ──────────────────────────────────────────────────────
      const leaving = prev.controls.filter(c => !want.has(c.process));
      if (!leaving.length) {
        // Nothing left the register. Still write back the archive and anything
        // restored — a pure widening is the commonest way this runs.
        return { ...prev, controls, runs, audits,
          deficiencies: [...prev.deficiencies, ...restored.deficiencies],
          tasks: [...prev.tasks, ...restored.tasks],
          discussions: [...prev.discussions, ...restored.discussions],
          reviewNotes: [...prev.reviewNotes, ...restored.reviewNotes],
          executions: [...prev.executions, ...restored.executions],
          scopeArchive: stillParked };
      }
      const gone = new Set(leaving.map(c => c.id));
      const goneRuns = runs
        .map(r => ({ run: r, entries: r.controls.filter(rc => gone.has(rc.controlId)) }))
        .filter(r => r.entries.length > 0);
      const entry: ScopeArchiveEntry = {
        id: uid('sa'), at: 'just now',
        processes: Array.from(new Set(leaving.map(c => c.process))),
        controls: leaving,
        deficiencies: prev.deficiencies.filter(d => gone.has(d.controlId)),
        tasks: prev.tasks.filter(t => gone.has(t.controlId)),
        discussions: prev.discussions.filter(d => gone.has(d.controlId)),
        reviewNotes: prev.reviewNotes.filter(n => gone.has(n.controlId)),
        executions: prev.executions.filter(e => gone.has(e.controlId)),
        runs: goneRuns,
        auditControlIds: Object.fromEntries(
          audits
            .filter(a => a.controlIds?.some(id => gone.has(id)))
            .map(a => [a.id, a.controlIds!.filter(id => gone.has(id))])),
      };
      const live = new Set(controls.map(c => c.id));
      return {
        ...prev,
        controls,
        deficiencies: [...prev.deficiencies, ...restored.deficiencies].filter(d => live.has(d.controlId)),
        tasks: [...prev.tasks, ...restored.tasks].filter(t => live.has(t.controlId)),
        discussions: [...prev.discussions, ...restored.discussions].filter(d => live.has(d.controlId)),
        reviewNotes: [...prev.reviewNotes, ...restored.reviewNotes].filter(n => live.has(n.controlId)),
        executions: [...prev.executions, ...restored.executions].filter(e => live.has(e.controlId)),
        runs: runs
          .map(r => ({ ...r, controls: r.controls.filter(rc => live.has(rc.controlId)) }))
          // A run whose every control has gone is a record of work on nothing —
          // it is not lost, it is in the archive entry above.
          .filter(r => r.controls.length > 0),
        // Only the hand-picked scope lists control ids; an audit scoped by RACM
        // filters by process at read time and needs nothing done to it here.
        // Which ids left is remembered on the archive entry above, so widening
        // scope again puts them back on the audit that had named them.
        audits: audits.map(a => (a.controlIds ? { ...a, controlIds: a.controlIds.filter(id => live.has(id)) } : a)),
        scopeArchive: [entry, ...stillParked],
      };
    });
  }, [role]);
  // The guarded path for changing the ground rules mid-engagement: applies the
  // patch, records who/what/why and every exception whose grade moved.
  const applyRules = useCallback<IcfrCtx['applyRules']>((patch, reason) => {
    if (role !== 'auditor') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const fmtVal = (field: string, v: number) => field === 'SD band' ? `${v}%` : formatINR(v);
      const fields: { field: string; from: number; to: number | undefined }[] = [
        { field: 'Overall materiality', from: prev.materiality, to: patch.materiality },
        { field: 'Performance materiality', from: prev.performanceMateriality, to: patch.performanceMateriality },
        { field: 'Clearly-trivial threshold', from: prev.rules.clearlyTrivial, to: patch.clearlyTrivial },
        { field: 'SD band', from: prev.rules.sdBandPct, to: patch.sdBandPct },
      ];
      const changes = fields
        .filter(f => f.to !== undefined && f.to !== f.from)
        .map(f => ({ field: f.field, from: fmtVal(f.field, f.from), to: fmtVal(f.field, f.to!) }));
      // Aggregation reads on/off rather than as a number, but it moves grades the
      // same way the thresholds do, so it is logged in the same entry.
      if (patch.aggregate !== undefined && patch.aggregate !== prev.rules.aggregate) {
        changes.push({ field: 'Aggregation', from: prev.rules.aggregate ? 'On' : 'Off', to: patch.aggregate ? 'On' : 'Off' });
      }
      if (!changes.length) return prev;
      const entry: RulesChangeEntry = {
        id: uid('rc'), changes, regraded: previewRegrades(prev, patch),
        reason, by: me, at: 'just now',
      };
      return {
        ...prev,
        materiality: patch.materiality ?? prev.materiality,
        performanceMateriality: patch.performanceMateriality ?? prev.performanceMateriality,
        rules: { ...prev.rules, clearlyTrivial: patch.clearlyTrivial ?? prev.rules.clearlyTrivial, sdBandPct: patch.sdBandPct ?? prev.rules.sdBandPct, aggregate: patch.aggregate ?? prev.rules.aggregate },
        rulesLog: [entry, ...prev.rulesLog],
      };
    });
  }, [me, role]);

  // ── The sampling methodology (#22) ────────────────────────────────────────────
  // Three acts, deliberately separate: the lead PROPOSES it, the reviewer SIGNS
  // it, and any later change REVISES it into a new version. Editing a signed
  // methodology through `propose` would let the agreement be moved out from
  // under the signature, which is the one thing the signature is there to stop.
  const proposeSampling = useCallback<IcfrCtx['proposeSampling']>((patch) => {
    if (role !== 'auditor') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const cur = samplingOf(prev);
      if (cur.reviewer) return prev; // signed — a change from here is a revision
      return { ...prev, samplingMethodology: { ...cur, ...patch, proposedBy: { by: me, at: 'just now' } } };
    });
  }, [me, role]);

  /** The reviewer's signature — what turns a proposal into the agreed method.
   *  Four-eyes: the person who proposed it cannot be the person who signs it. */
  const signSampling = useCallback<IcfrCtx['signSampling']>(() => {
    if (role !== 'reviewer') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const cur = samplingOf(prev);
      if (cur.reviewer || samePerson(cur.proposedBy, me)) return prev;
      return { ...prev, samplingMethodology: { ...cur, reviewer: { by: me, at: 'just now' } } };
    });
  }, [me, role]);

  /** A change to an agreed methodology. Never edits in place: it mints the next
   *  version and logs what moved, so an audit already running can stay on the
   *  version it was created under and its working paper can still name it. */
  const reviseSampling = useCallback<IcfrCtx['reviseSampling']>((patch, reason) => {
    if (role !== 'auditor' || !reason.trim()) return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const cur = samplingOf(prev);
      const changes: { field: string; from: string; to: string }[] = [];
      if (patch.method && patch.method !== cur.method) changes.push({ field: 'Selection method', from: cur.method, to: patch.method });
      // Said as the groups themselves, not as a count: "Quarters, Entities →
      // Quarters" is the change; "2 → 1" is a number nobody can check.
      if (patch.spread && spreadLabel(patch.spread) !== spreadLabel(cur.spread)) {
        changes.push({ field: 'Spread across', from: spreadLabel(cur.spread), to: spreadLabel(patch.spread) });
      }
      if (patch.roundBasis && patch.roundBasis !== cur.roundBasis) {
        const say = (b: SamplingRoundBasis) => (b === 'per-round' ? 'Per round' : 'Whole period');
        changes.push({ field: 'Across rounds', from: say(cur.roundBasis), to: say(patch.roundBasis) });
      }
      // One line per cell that moved, named as the auditor reads it off the
      // table — "Monthly · High" says more than "sizes.Monthly.high".
      if (patch.sizes) {
        (Object.keys(cur.sizes) as Frequency[]).forEach(f => {
          (['low', 'medium', 'high'] as const).forEach(r => {
            const to = patch.sizes?.[f]?.[r];
            if (to != null && to !== cur.sizes[f][r]) {
              changes.push({ field: `${f} · ${r[0]!.toUpperCase()}${r.slice(1)} risk`, from: String(cur.sizes[f][r]), to: String(to) });
            }
          });
        });
      }
      if (!changes.length) return prev;
      const version = cur.version + 1;
      const entry: SamplingChangeEntry = { id: uid('sm'), version, changes, reason: reason.trim(), by: me, at: 'just now' };
      return {
        ...prev,
        samplingMethodology: {
          ...cur, ...patch,
          sizes: patch.sizes ? { ...cur.sizes, ...patch.sizes } : cur.sizes,
          version,
          // A new version is a new agreement: it is proposed, not yet signed.
          proposedBy: { by: me, at: 'just now' },
          reviewer: undefined,
        },
        samplingLog: [entry, ...(prev.samplingLog ?? [])],
      };
    });
  }, [me, role]);
  // The one lifecycle move that is not somebody's named act elsewhere: the owner
  // declaring their fix done and ready to be tested. Everything else on the ladder
  // has its own gated mutator, so this stays narrow — a generic status setter with
  // no legal-move check is a back door around every rung the ladder describes.
  const setExceptionStatus = useCallback<IcfrCtx['setExceptionStatus']>((id, status) => {
    if (status !== 'Retest' || role !== 'risk-owner') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const target = prev.deficiencies.find(d => d.id === id);
      if (!target || target.status !== 'Remediation') return prev;   // only the fixing step submits
      // Same by-name ownership question ownsIt asks, read the other way round:
      // there it forbids auditing your own control, here it is the thing that
      // makes this yours to declare. One owner persona cannot submit another's fix.
      if (!ownsIt(prev, target.controlId, meOwner)) return prev;
      if (!target.remediation.evidence?.length) return prev;         // "done" needs proof
      // Whoever judged the plan cannot also be the one declaring it built.
      if (samePerson(target.planReview, meOwner)) return prev;
      // every lifecycle move carries its actor + time into the shared trail
      const event: ExecutionEvent = {
        id: uid('ex'), controlId: target.controlId, track: target.track, kind: 'exception',
        verb: `submitted the fix for retest (${id})`,
        by: me, role, at: 'just now',
      };
      return {
        ...prev,
        deficiencies: prev.deficiencies.map(d => (
          d.id === id
            ? { ...d, status, fixSubmitted: { by: meOwner, at: 'just now' }, remediation: { ...d.remediation, status: 'Done' as const } }
            : d
        )),
        // submitting the fix also clears the owner's remediation reminder — one
        // declaration, both surfaces agree (portal checklist ↔ exceptions page)
        tasks: prev.tasks.map(t => t.type === 'remediation' && t.controlId === target.controlId && t.status === 'open' ? { ...t, status: 'cleared' as const } : t),
        executions: [event, ...prev.executions],
      };
    });
  }, [me, role, meOwner]);
  // ─── Step 5 · the retest ──────────────────────────────────────────────────────
  // The control is tested AGAIN, not re-read. A fresh sample comes off the period
  // SINCE THE FIX LANDED — items from before it prove nothing about the repair —
  // and it is marked against the same attributes the original test used, so a pass
  // means the same thing it meant the first time.
  const drawRetestSample = useCallback<IcfrCtx['drawRetestSample']>((id) => {
    if (role !== 'auditor') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const target = prev.deficiencies.find(d => d.id === id);
      if (!target || target.status !== 'Retest' || target.retestDraft) return prev;
      // A design failure is not retested on a sample — its TOE attributes are not
      // what failed. It re-checks its failed design checks (setRetestCheck).
      if (target.track === 'design') return prev;
      if (ownsIt(prev, target.controlId, me)) return prev;
      const c = prev.controls.find(x => x.id === target.controlId);
      if (!c) return prev;
      // The same attributes, carried over verbatim — a retest that invents its own
      // is not a retest of anything.
      const attributes = c.operating.steps.map(s => ({ code: s.code, description: s.description }));
      // Sized against the ITGC state, like every other draw: a retest of an
      // automated control whose ITGCs have failed cannot be one item — the reason
      // it is being retested is that one item no longer proves anything.
      const size = sampleSizeGuide(c, itgcHolds(prev, c), samplingOf(prev)).suggested;
      const from = parseLooseDate(target.remediation.date) ?? new Date();
      const to = new Date();
      const iso = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      const span = Math.max(1, to.getTime() - from.getTime());
      const samples = sampleRefs(c.process, size).map((ref, i) => {
        const at = new Date(from.getTime() + (span * (i + 1)) / (size + 1));
        return { id: uid('rs'), ref, date: iso(at) };
      });
      const round: RetestRound = {
        n: (target.retests?.length ?? 0) + 1,
        windowFrom: iso(from), windowTo: iso(to),
        attributes, samples,
        results: Object.fromEntries(samples.map(s => [s.id, Object.fromEntries(attributes.map(a => [a.code, 'Not tested' as TestResult]))])),
        result: 'Fail', by: me, at: 'just now',
      };
      const event: ExecutionEvent = {
        id: uid('ex'), controlId: target.controlId, track: target.track, kind: 'sample',
        verb: `drew ${samples.length} item${samples.length === 1 ? '' : 's'} for retest ${round.n} of ${id}`,
        target: `${round.windowFrom} → ${round.windowTo}`, by: me, role, at: 'just now',
        rationale: 'Post-fix period only — items from before the fix cannot evidence it.',
      };
      return {
        ...prev,
        deficiencies: prev.deficiencies.map(d => (d.id === id ? { ...d, retestDraft: round } : d)),
        executions: [event, ...prev.executions],
      };
    });
  }, [me, role]);

  const setRetestResult = useCallback<IcfrCtx['setRetestResult']>((id, sampleId, attrCode, result) => {
    if (role !== 'auditor') return;
    setEng(prev => isEngagementLocked(prev) ? prev : ({
      ...prev,
      deficiencies: prev.deficiencies.map(d => {
        if (d.id !== id || !d.retestDraft) return d;
        const results = { ...d.retestDraft.results, [sampleId]: { ...d.retestDraft.results[sampleId], [attrCode]: result } };
        return { ...d, retestDraft: { ...d.retestDraft, results } };
      }),
    }));
  }, [role]);

  // ── The design-track retest ──────────────────────────────────────────────────
  // A TOD failure has no sample to redraw: what failed was the design, so the
  // retest re-checks the design checks that failed, against the evidence the
  // owner attached to the fix. The same checks every round — `designRetestChecks`
  // — and they are copied onto the round when it starts, so nothing done to the
  // TOD while the retest is open can move them. Like the sampled retest it never
  // writes to the control: the round is the evidence, the TOD stays as concluded.
  const setRetestCheck = useCallback<IcfrCtx['setRetestCheck']>((id, pointId, result) => {
    if (role !== 'auditor') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const target = prev.deficiencies.find(d => d.id === id);
      if (!target || target.track !== 'design' || target.status !== 'Retest') return prev;
      if (ownsIt(prev, target.controlId, me)) return prev;
      const draft = designRetestDraft(prev, target, me);
      if (!draft?.checks?.some(x => x.pointId === pointId)) return prev;
      const checks = draft.checks.map(x => (x.pointId === pointId ? { ...x, result } : x));
      return { ...prev, deficiencies: prev.deficiencies.map(d => (d.id === id ? { ...d, retestDraft: { ...draft, checks } } : d)) };
    });
  }, [me, role]);

  // Ira on the retest's checks only, on the auditor's ask — the retest's twin of
  // runDesignIra, and deterministic the same way: with the fix evidence on file a
  // check passes unless the auditor had already marked it failed. With nothing on
  // file there is nothing to read, so it does not run.
  const runRetestIra = useCallback<IcfrCtx['runRetestIra']>((id) => {
    if (role !== 'auditor') return;
    const at = fmtDateTime();
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const target = prev.deficiencies.find(d => d.id === id);
      if (!target || target.track !== 'design' || target.status !== 'Retest') return prev;
      if (ownsIt(prev, target.controlId, me)) return prev;
      const files = (target.remediation.evidence ?? []).map(f => f.name);
      if (!files.length) return prev;
      const draft = designRetestDraft(prev, target, me);
      if (!draft?.checks?.length) return prev;
      const list = files.length < 2 ? files.join('') : `${files.slice(0, -1).join(', ')} and ${files[files.length - 1]}`;
      let failed = 0;
      const checks = draft.checks.map(x => {
        const stoodFailed = x.result === 'Fail';
        if (stoodFailed) failed += 1;
        const res: TestResult = stoodFailed ? 'Fail' : 'Pass';
        const qa = [
          { q: RETEST_FIX_ON_FILE_Q, a: `Yes — ${list}.`, pass: true },
          ...(stoodFailed ? [{ q: IRA_STOOD_FAILED_Q, a: 'Yes — it was marked failed before Ira ran.', pass: false }] : []),
          ...designCheckQA(x.text, stoodFailed),
        ];
        const summary = stoodFailed
          ? 'Ira read the fix evidence, and the design still falls short on this check — the answers below say where.'
          : 'Ira read the fix evidence and found the fixed design supports this check.';
        return { ...x, result: res, validation: { result: res, qa, summary, fileName: files.join(', '), at } };
      });
      const event: ExecutionEvent = {
        id: uid('ex'), controlId: target.controlId, track: 'design', kind: 'ai-review',
        verb: `ran Ira on ${checks.length} design check${checks.length === 1 ? '' : 's'} for retest ${draft.n} of ${id} — ${checks.length - failed} passed, ${failed} failed`,
        result: failed > 0 ? 'Fail' : 'Pass', by: me, role, at: 'just now',
      };
      return {
        ...prev,
        deficiencies: prev.deficiencies.map(d => (d.id === id ? { ...d, retestDraft: { ...draft, checks } } : d)),
        executions: [event, ...prev.executions],
      };
    });
  }, [me, role]);

  // A passed retest never closes itself — it parks at 'Awaiting reviewer'. Only
  // the auditor records retest results; the owner never tests their own fix. A
  // failure reopens the WORK, not the plan: it lands back on the owner's fixing
  // step with the auditor's rationale attached, the accepted plan still standing,
  // and the loop counter bumped. Rewriting a plan the auditor already approved is
  // a separate judgement — when the plan is the problem, two failures put it in
  // front of the reviewer, who can send it back for a new one.
  const recordRetest = useCallback<IcfrCtx['recordRetest']>((id, rationale) => {
    if (role !== 'auditor') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const target = prev.deficiencies.find(d => d.id === id);
      if (!target || target.status !== 'Retest' || !target.retestDraft) return prev;
      // Nor do you test the repair you declared finished.
      if (samePerson(target.fixSubmitted, me)) return prev;
      if (ownsIt(prev, target.controlId, me)) return prev;
      const draft = target.retestDraft;
      // A design failure is only ever retested on its checks, never on a sample.
      if (target.track === 'design' && !draft.checks?.length) return prev;
      // Pass only when every listed check passes — the same rule as the grid.
      const marks = draft.checks
        ? draft.checks.map(x => x.result)
        : draft.samples.flatMap(s => draft.attributes.map(a => draft.results[s.id]?.[a.code] ?? 'Not tested'));
      if (marks.some(m => m === 'Not tested')) return prev;             // finish the grid first
      const result: 'Pass' | 'Fail' = marks.includes('Fail') ? 'Fail' : 'Pass';
      if (result === 'Fail' && !rationale?.trim()) return prev;         // the owner has to be told why
      const round: RetestRound = { ...draft, result, rationale: rationale?.trim(), by: me, at: 'just now' };
      const to: ExceptionStatus = result === 'Pass' ? 'Awaiting reviewer' : 'Remediation';
      const rounds = [...(target.retests ?? []), round];
      const event: ExecutionEvent = {
        id: uid('ex'), controlId: target.controlId, track: target.track, kind: 'exception',
        verb: `recorded retest ${round.n} — ${result.toLowerCase()} on ${id}`, result,
        from: 'Retest', to, rationale: rationale?.trim(), by: me, role, at: 'just now',
      };
      return {
        ...prev,
        deficiencies: prev.deficiencies.map(d => d.id === id ? {
          ...d,
          retests: rounds,
          retestDraft: undefined,
          retest: { result, at: 'just now', by: me },
          status: to,
          // The plan and its acceptance survive a failed retest — the owner is
          // doing the agreed work again, not writing a new commitment.
          remediation: { ...d.remediation, status: result === 'Pass' ? 'Done' : 'In progress' },
        } : d),
        executions: [event, ...prev.executions],
      };
    });
  }, [me, role]);

  // The remediation plan is the owner's commitment — the action on the root
  // cause, who does it, by when, and the evidence behind "done". The auditor
  // advises but never writes the plan. Frozen once the fix is submitted.
  const updateRemediation = useCallback<IcfrCtx['updateRemediation']>((id, patch) => {
    if (role !== 'risk-owner') return;
    setEng(prev => isEngagementLocked(prev) ? prev : ({ ...prev, deficiencies: prev.deficiencies.map(d => {
      if (d.id !== id) return d;
      // Writable while the owner still holds it: step 3 before it goes up for
      // review, and step 4 while the fix is being done. Once it is with the
      // auditor — for the plan or for the retest — it is frozen.
      if (d.status !== 'Planning' && d.status !== 'Remediation') return d;
      // And it has to be YOUR control: the hat says risk owner, the name says
      // which one. Writing somebody else's commitment is not a plan.
      if (!ownsIt(prev, d.controlId, meOwner)) return d;
      return { ...d, remediation: { ...d.remediation, ...patch } };
    }) }));
  }, [role, meOwner]);
  const addRemediationEvidence = useCallback<IcfrCtx['addRemediationEvidence']>((id, fileName) => {
    if (role !== 'risk-owner') return;
    setEng(prev => isEngagementLocked(prev) ? prev : ({ ...prev, deficiencies: prev.deficiencies.map(d => {
      if (d.id !== id) return d;
      if (!ownsIt(prev, d.controlId, meOwner)) return d;
      const file: EvidenceFile = { id: uid('f'), name: fileName, kind: fileName.endsWith('.xlsx') ? 'XLSX' : 'PDF', uploadedBy: me, uploadedAt: 'just now' };
      return { ...d, remediation: { ...d.remediation, evidence: [...(d.remediation.evidence ?? []), file] } };
    }) }));
  }, [me, role, meOwner]);

  // ─── The owner argues with the grading, on the record ─────────────────────────
  // Scoped to their OWN controls, not merely to the risk-owner hat: the point of a
  // challenge is that the person carrying the fix gets a say, and someone else's
  // exception is not theirs to contest.
  const raiseChallenge = useCallback<IcfrCtx['raiseChallenge']>((id, input, reasoning, fileName) => {
    if (role !== 'risk-owner') return;
    if (!reasoning.trim()) return;                       // a challenge with no argument is a complaint
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const target = prev.deficiencies.find(d => d.id === id);
      if (!target || target.status === 'Closed') return prev;
      const c = prev.controls.find(x => x.id === target.controlId);
      if (!c || !isOwnerOf(c, meOwner)) return prev;
      // One live argument at a time. Several open at once is a queue rather than
      // a conversation, and it makes "what is being disputed here" unanswerable
      // for the reviewer reading it later.
      if (target.challenges?.some(ch => !ch.response)) return prev;
      const evidence: EvidenceFile[] | undefined = fileName
        ? [{ id: uid('f'), name: fileName, kind: fileName.endsWith('.xlsx') ? 'XLSX' : 'PDF', uploadedBy: meOwner, uploadedAt: 'just now' }]
        : undefined;
      const challenge: SeverityChallenge = {
        id: uid('ch'), input, reasoning: reasoning.trim(), evidence,
        by: meOwner, at: 'just now', gradeAtRaise: gradeException(target, prev).grade,
      };
      const event: ExecutionEvent = {
        id: uid('ex'), controlId: target.controlId, track: target.track, kind: 'challenge',
        verb: `challenged the ${input} on ${id}`, target: input,
        rationale: challenge.reasoning, by: meOwner, role, at: 'just now',
      };
      return {
        ...prev,
        deficiencies: prev.deficiencies.map(d => (d.id === id ? { ...d, challenges: [...(d.challenges ?? []), challenge] } : d)),
        executions: [event, ...prev.executions],
      };
    });
  }, [meOwner, role]);

  // The auditor answers. Accepting does NOT move the number — it records that the
  // argument landed; the auditor then edits the input themselves through
  // `updateDeficiency`, and the engine re-grades off that edit with its own trail
  // entry. Keeping the two apart is what stops a challenge from being a second,
  // undocumented way to change a grade.
  const respondToChallenge = useCallback<IcfrCtx['respondToChallenge']>((id, challengeId, decision, reason) => {
    if (role !== 'auditor') return;
    if (!reason.trim()) return;                          // required either way
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const target = prev.deficiencies.find(d => d.id === id);
      const challenge = target?.challenges?.find(ch => ch.id === challengeId);
      if (!target || !challenge || challenge.response) return prev;
      if (ownsIt(prev, target.controlId, me)) return prev;
      const event: ExecutionEvent = {
        id: uid('ex'), controlId: target.controlId, track: target.track, kind: 'challenge',
        verb: `${decision === 'Accepted' ? 'accepted' : 'declined'} ${challenge.by}'s challenge to the ${challenge.input} on ${id}`,
        target: challenge.input, rationale: reason.trim(), by: me, role, at: 'just now',
      };
      return {
        ...prev,
        deficiencies: prev.deficiencies.map(d => (d.id === id ? {
          ...d,
          challenges: (d.challenges ?? []).map(ch => ch.id === challengeId
            ? { ...ch, response: { decision, reason: reason.trim(), by: me, at: 'just now' } }
            : ch),
        } : d)),
        executions: [event, ...prev.executions],
      };
    });
  }, [me, role]);
  // Four-eyes: only the reviewer hat closes, and never the person who ran the retest.
  const signOffException = useCallback<IcfrCtx['signOffException']>((id) => {
    if (role !== 'reviewer') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const target = prev.deficiencies.find(d => d.id === id);
      if (!target || target.status !== 'Awaiting reviewer' || samePerson(target.retest, me)) return prev;
      if (ownsIt(prev, target.controlId, me)) return prev;
      const event: ExecutionEvent = {
        id: uid('ex'), controlId: target.controlId, track: target.track, kind: 'exception',
        verb: `closed ${id} — reviewer sign-off`, by: me, role, at: 'just now',
      };
      return {
        ...prev,
        deficiencies: prev.deficiencies.map(d => d.id === id ? { ...d, signoff: { by: me, at: 'just now' }, status: 'Closed' } : d),
        executions: [event, ...prev.executions],
      };
    });
  }, [me, role]);

  // A closed exception can come back, and only the reviewer can bring it — they
  // signed it closed, so undoing that signature is theirs. Reason required. It
  // returns to Remediation (the fix must be re-proven); the stale retest clears.
  const reopenException = useCallback<IcfrCtx['reopenException']>((id, reason) => {
    if (role !== 'reviewer') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const target = prev.deficiencies.find(d => d.id === id);
      if (!target || target.status !== 'Closed' || !reason.trim()) return prev;
      const event: ExecutionEvent = {
        id: uid('ex'), controlId: target.controlId, track: target.track, kind: 'exception',
        verb: `reopened ${id} — ${short(reason, 80)}`, by: me, role, at: 'just now',
      };
      return {
        ...prev,
        deficiencies: prev.deficiencies.map(d => d.id === id
          ? { ...d, status: 'Remediation', signoff: undefined, retest: undefined, remediation: { ...d.remediation, status: 'In progress' } }
          : d),
        executions: [event, ...prev.executions],
      };
    });
  }, [me, role]);

  // ─── Unable to test — a status on the CONTROL, never an exception ─────────────
  // When the auditor cannot test — no evidence, the population is unavailable, the
  // owner has not produced what was asked for — nothing has been shown to have
  // failed. Exposure and likelihood do not apply, so a severity would be invented.
  // It sits in the owner's court like any other document request until testing can
  // resume, and only becomes an exception if the period closes with it still open.
  const markUnableToTest = useCallback<IcfrCtx['markUnableToTest']>((controlId, track, reason, needed) => {
    if (role !== 'auditor' || !reason.trim() || !needed.trim()) return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const c = prev.controls.find(x => x.id === controlId);
      // A concluded control cannot also be blocked — it was tested, and the
      // paper says what it concluded. Reopening is the way to say otherwise.
      if (!c || c.unableToTest || isControlLockedIn(prev, c)) return prev;
      const block: UnableToTest = { track, reason: reason.trim(), needed: needed.trim(), raisedBy: me, raisedAt: 'just now' };
      const task: HandoffTask = {
        id: `UTT-${prev.tasks.length + 1}`, type: 'pbc', controlId,
        title: `Testing blocked on ${c.wpRef} — ${short(needed, 60)}`,
        // Blocked testing is waiting on evidence, so it waits on the process owner.
        detail: reason.trim(), assignee: ownersOf(c).processOwner, assigneeRole: 'risk-owner',
        raisedBy: me, dueLabel: 'Due in 5d', overdue: false, status: 'open',
      };
      const event: ExecutionEvent = {
        id: uid('ex'), controlId, track, kind: 'request-docs',
        verb: `recorded unable to test — waiting on ${c.owner}`, target: short(needed, 60),
        rationale: reason.trim(), by: me, role, at: 'just now',
      };
      return {
        ...prev,
        controls: prev.controls.map(x => (x.id === controlId ? { ...x, unableToTest: block } : x)),
        tasks: [...prev.tasks, task],
        executions: [event, ...prev.executions],
      };
    });
  }, [me, role]);

  // The owner produced it — testing resumes and the block simply goes away. It was
  // never a finding, so there is nothing to close out.
  const resolveUnableToTest = useCallback<IcfrCtx['resolveUnableToTest']>((controlId) => {
    if (role !== 'auditor') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const c = prev.controls.find(x => x.id === controlId);
      if (!c?.unableToTest || c.unableToTest.convertedTo) return prev;
      const event: ExecutionEvent = {
        id: uid('ex'), controlId, track: c.unableToTest.track, kind: 'receive-doc',
        verb: 'received what was missing — testing resumes', by: me, role, at: 'just now',
      };
      return {
        ...prev,
        controls: prev.controls.map(x => (x.id === controlId ? { ...x, unableToTest: undefined } : x)),
        tasks: prev.tasks.map(t => (t.controlId === controlId && t.type === 'pbc' && t.status === 'open' ? { ...t, status: 'cleared' as const } : t)),
        executions: [event, ...prev.executions],
      };
    });
  }, [me, role]);

  // Period end, still nothing. The control could not be evidenced as operating, so
  // it concludes ineffective and runs the ordinary ladder — no second lifecycle,
  // no special grade. The reason carries onto the exception so the working paper
  // shows WHY it was never evidenced, not merely that it failed.
  const escalateUnableToTest = useCallback<IcfrCtx['escalateUnableToTest']>((controlId) => {
    if (role !== 'auditor') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const c = prev.controls.find(x => x.id === controlId);
      // This writes a track conclusion, so it is a testing act and obeys the lock.
      if (!c?.unableToTest || c.unableToTest.convertedTo || isControlLockedIn(prev, c)) return prev;
      const block = c.unableToTest;
      const next = Math.max(0, ...prev.deficiencies.map(d => parseInt(d.id.replace(/\D/g, ''), 10) || 0)) + 1;
      const defId = `DEF-${String(next).padStart(3, '0')}`;
      const def: Deficiency = {
        id: defId, controlId, track: block.track,
        description: `${c.wpRef} could not be evidenced as operating — ${short(block.needed, 80)} was never produced.`,
        rootCause: '',
        failedSamples: [],
        likelihood: 'Reasonably possible', magnitude: 0, mwIndicators: [],
        aggregationGroup: c.process,
        remediation: { action: '', date: null, owner: c.owner, status: 'Open' },
        status: 'Identified',
        unableToTestReason: block.reason,
      };
      // Ira's first sizing, as on every other raise (S9, A31).
      const sized = suggestSizing(def, prev, exposureContext(prev, openAuditId, c));
      def.likelihood = sized.likelihood;
      def.magnitude = sized.magnitude;
      def.compensatingControlId = sized.compensatingControlId;
      def.iraSuggested = sized.iraSuggested;
      const event: ExecutionEvent = {
        id: uid('ex'), controlId, track: block.track, kind: 'exception',
        verb: `raised ${defId} — never evidenced, scope limitation at period end`,
        from: 'Unable to test', to: 'Identified', rationale: block.reason, by: me, role, at: 'just now',
      };
      return {
        ...prev,
        controls: prev.controls.map(x => (x.id === controlId
          ? {
            ...x,
            unableToTest: { ...block, convertedTo: defId },
            [block.track]: { ...x[block.track], conclusion: 'Ineffective' as TrackConclusion, testedBy: me, testedAt: 'just now',
              // A design concluded this way still goes to the reviewer (S6, A36).
              ...(block.track === 'design' ? { approval: { preparedBy: { by: me, at: 'just now' } }, designReturn: undefined } : {}) },
          } : x)),
        deficiencies: [def, ...prev.deficiencies],
        executions: [iraSizingEvent(def, role), event, ...prev.executions],
      };
    });
  }, [me, role, openAuditId]);

  // The only way back into a concluded control: the auditor reopens it with a
  // reason. Results stay; both tracks' conclusions clear; the trail records why.
  const reopenControl = useCallback<IcfrCtx['reopenControl']>((controlId, reason) => {
    if (role !== 'auditor') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const target = prev.controls.find(c => c.id === controlId);
      if (!target || !isControlLockedIn(prev, target)) return prev;
      const event: ExecutionEvent = {
        id: uid('ex'), controlId, track: 'design', kind: 'reopen',
        verb: 'reopened the control', target: reason ? short(reason, 80) : undefined,
        by: me, role, at: 'just now',
      };
      return {
        ...prev,
        controls: prev.controls.map(c => c.id === controlId ? {
          ...c,
          // The design approval goes with the conclusion it approved (S6, A36).
          design: { ...c.design, conclusion: 'Not tested', override: undefined, testedBy: null, testedAt: null, approval: undefined },
          operating: { ...c.operating, conclusion: 'Not tested', override: undefined, testedBy: null, testedAt: null },
          wpSignoff: undefined, // a reopened control's paper is no longer the signed one
          // In full, on the control — the trail's line is clipped at 80 characters,
          // and a reader asking why a signed conclusion was undone needs the answer
          // on the paper, not only in the history rail.
          reopened: { reason: reason?.trim() ?? '', by: me, at: 'just now' },
          reviewReturn: undefined,   // a reopen supersedes the reviewer's send-back
        } : c),
        executions: [event, ...prev.executions],
      };
    });
  }, [me, role]);

  // Per-working-paper sign-off: the auditor signs a control's paper once that
  // control is concluded; the reviewer countersigns after. Reopening clears both.
  const signOffControlWp = useCallback<IcfrCtx['signOffControlWp']>((controlId, step) => {
    if (step === 'preparer' && role !== 'auditor') return;
    if (step === 'reviewer' && role !== 'reviewer') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const target = prev.controls.find(c => c.id === controlId);
      if (!target || !isControlLockedIn(prev, target)) return prev;       // only a concluded control's paper can be signed
      if (step === 'preparer' && target.wpSignoff?.preparer) return prev; // already signed
      if (step === 'reviewer' && (!target.wpSignoff?.preparer || target.wpSignoff.reviewer)) return prev; // countersign follows the preparer
      if (step === 'reviewer' && prev.reviewNotes.some(n => n.controlId === controlId && n.status !== 'Closed')) return prev; // notes must clear before the countersign
      if (step === 'reviewer' && target.wpSignoff?.preparer?.by === me) return prev; // self-review guard: the paper's preparer never countersigns it
      const event: ExecutionEvent = {
        id: uid('ex'), controlId, track: 'operating', kind: 'wp-signoff',
        verb: step === 'preparer' ? 'signed off the working paper' : 'countersigned the working paper',
        by: me, role, at: 'just now',
      };
      return {
        ...prev,
        controls: prev.controls.map(c => c.id === controlId ? {
          ...c,
          wpSignoff: step === 'preparer'
            ? { ...c.wpSignoff, preparer: { by: me, at: 'just now' } }
            : { ...c.wpSignoff, reviewer: { by: me, at: 'just now' } },
        } : c),
        executions: [event, ...prev.executions],
      };
    });
  }, [me, role]);

  // Return instead of countersign: both track conclusions clear (results stay,
  // like a reopen), signatures void, and the reviewer's note lands on the dossier
  // — the control walks back into the auditor's court until it re-concludes.
  const returnControl = useCallback<IcfrCtx['returnControl']>((controlId, reason) => {
    if (role !== 'reviewer') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const target = prev.controls.find(c => c.id === controlId);
      if (!target || !isControlLocked(target) || target.wpSignoff?.reviewer) return prev;
      const event: ExecutionEvent = {
        id: uid('ex'), controlId, track: 'operating', kind: 'review-return',
        verb: 'returned the control to the auditor', target: reason ? short(reason, 80) : undefined,
        by: me, role, at: 'just now',
      };
      return {
        ...prev,
        controls: prev.controls.map(c => c.id === controlId ? {
          ...c,
          design: { ...c.design, conclusion: 'Not tested', override: undefined, testedBy: null, testedAt: null, approval: undefined },
          operating: { ...c.operating, conclusion: 'Not tested', override: undefined, testedBy: null, testedAt: null },
          wpSignoff: undefined,
          reviewReturn: { reason, by: me, at: 'just now' },
          reopened: undefined,       // and a send-back supersedes an earlier reopen
        } : c),
        executions: [event, ...prev.executions],
      };
    });
  }, [me, role]);

  // ── review notes — raise (reviewer) → resolve (auditor) → verify/reopen (reviewer).
  // The role gates ARE the four-eyes: the raiser can't resolve their own note, and
  // the resolver can't verify it. Each stage stamps its own actor + time.
  const raiseReviewNote = useCallback<IcfrCtx['raiseReviewNote']>((controlId, text) => {
    if (role !== 'reviewer') return;
    setEng(prev => isEngagementLocked(prev) ? prev : ({
      ...prev,
      reviewNotes: [{ id: uid('rn'), controlId, text, raisedBy: me, raisedAt: 'just now', status: 'Open' as const }, ...prev.reviewNotes],
    }));
  }, [me, role]);
  const resolveReviewNote = useCallback<IcfrCtx['resolveReviewNote']>((noteId, response) => {
    if (role !== 'auditor') return;
    setEng(prev => isEngagementLocked(prev) ? prev : ({
      ...prev,
      reviewNotes: prev.reviewNotes.map(n => n.id === noteId && n.status === 'Open'
        ? { ...n, status: 'Resolved' as const, resolution: { text: response, by: me, at: 'just now' } } : n),
    }));
  }, [me, role]);
  const verifyReviewNote = useCallback<IcfrCtx['verifyReviewNote']>((noteId) => {
    if (role !== 'reviewer') return;
    setEng(prev => isEngagementLocked(prev) ? prev : ({
      ...prev,
      reviewNotes: prev.reviewNotes.map(n => n.id === noteId && n.status === 'Resolved'
        ? { ...n, status: 'Closed' as const, verified: { by: me, at: 'just now' } } : n),
    }));
  }, [me, role]);
  const reopenReviewNote = useCallback<IcfrCtx['reopenReviewNote']>((noteId) => {
    if (role !== 'reviewer') return;
    setEng(prev => isEngagementLocked(prev) ? prev : ({
      ...prev,
      reviewNotes: prev.reviewNotes.map(n => n.id === noteId && n.status === 'Resolved'
        ? { ...n, status: 'Open' as const } : n),
    }));
  }, [role]);

  // Create a control from the focused form — W/P ref and ID continue the
  // process's existing numbering; the control lands ready to test.
  const addControl = useCallback<IcfrCtx['addControl']>((draft) => {
    if (isEngagementLocked(eng)) return '';
    const inProc = eng.controls.filter(c => c.process === draft.process);
    const wpPrefix = inProc[0]?.wpRef.split('-')[0]
      ?? (draft.process.split(/\s+/).map(w => w[0]?.toUpperCase() ?? '').join('').slice(0, 2) || 'C');
    const nums = eng.controls
      .filter(c => c.wpRef.startsWith(`${wpPrefix}-`))
      .map(c => parseInt(c.wpRef.slice(wpPrefix.length + 1), 10))
      .filter(n => !Number.isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    const wpRef = `${wpPrefix}-${String(next).padStart(2, '0')}`;
    // IDs read ENTITY/PROCESS/R001/C001 (S11; entity first since 17 Sep). An existing risk keeps its ID and
    // the control takes the next C under it; a new risk takes the next R for the
    // process at the company its other controls are tested at.
    const entity = inProc[0]?.entity ?? eng.entity;
    const pc = processCodeFor(draft.process);
    const ec = entityCodeFor(entity);
    const rPrefix = `${ec}/${pc}/R`;
    const riskId = eng.controls.find(c => c.riskId === draft.riskId)?.riskId ?? riskIdOf(ec, pc, 1 + Math.max(0,
      ...eng.controls.filter(c => c.riskId.startsWith(rPrefix)).map(c => parseInt(c.riskId.slice(rPrefix.length), 10)).filter(n => !Number.isNaN(n))));
    const cNo = 1 + Math.max(0, ...eng.controls.filter(c => c.riskId === riskId).map(c => parseInt(c.id.split('/C').pop() ?? '', 10)).filter(n => !Number.isNaN(n)));
    let id = `${riskId}/C${String(cNo).padStart(3, '0')}`;
    if (eng.controls.some(c => c.id === id)) id = uid(riskId);
    const assertions: Assertion[] = draft.assertions.length ? draft.assertions : ['Accuracy'];
    // The form's design checks and attributes, in the shapes an upload gives
    // them (controlFromRow): checks as control-level design points, the same
    // check twice kept once; attributes as operating steps numbered off the W/P.
    const same = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
    const checks = (draft.designChecks ?? []).map(t => t.trim()).filter(Boolean)
      .filter((t, i, all) => all.findIndex(x => same(x) === same(t)) === i);
    const points: DesignPoint[] = checks.map(text => ({
      id: uid('dp'), text, result: 'Not tested', workflowId: uid('wf-tod'), workflowName: 'Design walkthrough check',
    }));
    const steps: OperatingStep[] = (draft.attributes ?? []).map(t => t.trim()).filter(Boolean).map((description, k) => ({
      id: uid('os'), code: `${wpRef}.${k + 1}`, description, assertion: assertions[0],
      precision: 'Per item', procedures: ['Inspection'], result: 'Not tested',
    }));
    const control: Control = {
      id, wpRef, description: draft.description, process: draft.process, entity,
      controlActivity: draft.controlActivity?.trim() || undefined,
      subProcess: draft.subProcess.trim() || 'General',
      nature: draft.nature, type: draft.type ?? 'Preventive', frequency: draft.frequency,
      isKey: draft.isKey, precision: draft.description, owner: draft.owner,
      // Falls through to the process's recorded process owner when the form
      // didn't name one, so a control created by hand still knows who to ask.
      processOwner: draft.processOwner?.trim() || peopleForProcess(draft.process)?.processOwner,
      ...(draft.riskOwner?.trim() ? { riskOwner: draft.riskOwner.trim() } : {}),
      ...(draft.clazz ? { clazz: draft.clazz } : {}),
      riskId, riskDescription: draft.riskDescription,
      ...(draft.riskTitle?.trim() ? { riskTitle: draft.riskTitle.trim() } : {}),
      ...(draft.effectiveDate?.trim() ? { effectiveDate: draft.effectiveDate.trim() } : {}),
      ...(draft.testingStrategy ? { testingStrategy: draft.testingStrategy } : {}),
      assertions,
      design: {
        documents: [
          { id: uid('dd'), kind: 'Process narrative', name: 'Process narrative — to provide', status: 'Missing' },
          { id: uid('dd'), kind: 'Control description', name: 'Control description — to provide', status: 'Missing' },
        ],
        points, conclusion: 'Not tested', testedBy: null, testedAt: null,
      },
      operating: { method: 'Manual', steps, conclusion: 'Not tested', testedBy: null, testedAt: null },
    };
    setEng(prev => ({ ...prev, controls: [...prev.controls, control] }));
    return id;
  }, [eng]);

  // Preparer signs first, reviewer countersigns — names come from the engagement record.
  // Each signature stamps the ICFR conclusion as of that moment: open MW ⇒ not effective.
  // Same-person guard: one human never holds both signatures on the opinion.
  /**
   * Sign off the OPEN AUDIT — preparer signs, reviewer countersigns.
   *
   * Sign-off moved from the engagement to the audit because that is where the
   * testing happens: an engagement spanning several cycles cannot have one
   * conclusion, and the ICFR opinion belongs to the period that was tested. Four
   * eyes still applies — the same person cannot do both.
   */
  const signOffAudit = useCallback<IcfrCtx['signOffAudit']>((step) => {
    // The hat must match the signature — the store backs what the UI hides.
    if (step === 'preparer' && role !== 'auditor') return;
    if (step === 'reviewer' && role !== 'reviewer') return;
    setEng(prev => {
      if (step === 'reviewer' && prev.reviewer === prev.preparer) return prev;
      const idx = prev.audits.findIndex(a => a.id === openAuditId);
      if (idx < 0) return prev;
      const a = prev.audits[idx]!;
      // Only the live cycle can be signed. An archived audit is history, and a
      // planned round has tested nothing — a signature there would stamp the live
      // cycle's numbers onto an empty record.
      if (prev.audits.find(x => !x.archive)?.id !== a.id) return prev;
      // The countersign follows the preparer, and each signature lands once.
      if (step === 'preparer' && a.signoff?.preparer) return prev;
      if (step === 'reviewer' && (!a.signoff?.preparer || a.signoff.reviewer)) return prev;
      const signoff = {
        ...a.signoff,
        ...(step === 'preparer'
          ? { preparer: { by: prev.preparer, at: 'just now' } }
          : { reviewer: { by: prev.reviewer, at: 'just now' } }),
        // The ICFR opinion is given as of the year-end date, so only a round
        // whose window reaches it can stamp one. An interim's signature
        // concludes the ROUND — and unlocks its roll-forward — but the year's
        // answer waits for the roll-forward or year-end (user ask). Stamping
        // here used to hand every interim a final-year verdict it never earned.
        ...(a.round !== 'interim' ? { icfrConclusion: icfrConclusion(prev) } : {}),
      };
      return { ...prev, audits: prev.audits.map((x, i) => (i === idx ? { ...x, signoff } : x)) };
    });
  }, [openAuditId, role]);

  const value = useMemo<IcfrCtx>(() => ({
    eng, role, tab, view, selectedControlId, racmEditor, me, meOwner, setMeOwner, racmProcess,
    setRole: changeRole, setTab, setView, openRacmMatrix, openRacmEditor, openControl, focusStep, clearFocusStep, openDeficiency, focusDefId, clearFocusDef, back, returnView,
    registerPreset, openRegister, clearRegisterPreset,
    racmCreateOpen, openRacmCreate, clearRacmCreate,
    setDocStatus, setDesignPoint, concludeDesign, overrideDesign, approveDesign, returnDesign,
    addDesignDoc, attachDesignEvidence, removeDesignDoc, waiveDesignDoc, clearDesignWaiver, updateControlMeta, setControlKey, setDesignJudgements, startWalkthrough, setWalkthroughAttribute, setWalkthroughMeta, addDesignPoint, removeDesignPoint, validateDesignPoint, overrideDesignPoint, removeDesignFile, runDesignIra, linkDesignPointEvidence, setDesignPointProof, requestDataByEmail,
    setPointEvidenceType, setStepEvidenceType, setDesignBasis,
    setPopulation, setPopulationDefinition, clearPopulation, setPopulationCheck, setPopulationFacts, addPopulationSource, removePopulationSource, setSourceRole, drawSourceSample, approveSource, redrawSource, remindOwnerForFiles, registerFile, setFileOrigin, lockPopulation, lockAttributes, confirmExtraction, recordException,
    addEvidenceReport, removeEvidenceReport, proveEvidenceReport,
    registerIpe, setIpeCheck, concludeIpe, clearIpe, setMrc, setSampling, extendSample, resizeSample, setSampleResult, setStepResult, overrideStep, pullStepRun, attestStep, addStepEvidence, setStepInputFile, concludeOperating, overrideOperating, startToeRound,
    addAttribute, removeAttribute, mapStepWorkflow, setStepEvidenceMode, toggleStepAttest, toggleStepAI, runStepValidation, testAllAttributes,
    addRequiredFile, renameRequiredFile, removeRequiredFile, uploadRequiredFile, clearRequiredFile, validateReadyAttributes,
    approveRacmRows, remarkRacmRow, clearRacmReview, bulkTestControls,
    createAudit, updateAudit, openAuditId, openAudit, closeAudit, racmDocs, addRacmDoc, createRacm, deleteRacm, addLibraryRacms,
    addComment, resolveDiscussion,
    submitTask, clearTask, raiseQuery, requestDesignDocs,
    updateRules, applyRules, updateMateriality, reconcileScope, updateDeficiency, linkRootCause, unlinkRootCause, setGroupConclusion, updateAccount, setExceptionStatus, completeSizing, confirmRating, returnRating, submitPlan, reviewPlan, drawRetestSample, setRetestResult, setRetestCheck, runRetestIra, recordRetest, signOffException, reopenException, updateRemediation, addRemediationEvidence, raiseChallenge, respondToChallenge, markUnableToTest, resolveUnableToTest, escalateUnableToTest,
    addControl, proposeSampling, signSampling, reviseSampling, signOffAudit, reopenControl, signOffControlWp, returnControl,
    raiseReviewNote, resolveReviewNote, verifyReviewNote, reopenReviewNote,
  }), [eng, role, tab, view, selectedControlId, racmEditor, me, meOwner, racmProcess, changeRole, setTab, openRacmMatrix, openRacmEditor, openControl, focusStep, clearFocusStep, openDeficiency, focusDefId, clearFocusDef, back, returnView, registerPreset, openRegister, clearRegisterPreset, racmCreateOpen, openRacmCreate, clearRacmCreate, setDocStatus, setDesignPoint, concludeDesign, overrideDesign, approveDesign, returnDesign, addDesignDoc, attachDesignEvidence, removeDesignDoc, waiveDesignDoc, clearDesignWaiver, updateControlMeta, setControlKey, setDesignJudgements, startWalkthrough, setWalkthroughAttribute, setWalkthroughMeta, addDesignPoint, removeDesignPoint, validateDesignPoint, overrideDesignPoint, removeDesignFile, runDesignIra, linkDesignPointEvidence, setDesignPointProof, requestDataByEmail, setPointEvidenceType, setStepEvidenceType, setDesignBasis, setPopulation, setPopulationDefinition, clearPopulation, setPopulationCheck, setPopulationFacts, addPopulationSource, removePopulationSource, setSourceRole, drawSourceSample, approveSource, redrawSource, remindOwnerForFiles, registerFile, setFileOrigin, lockPopulation, lockAttributes, confirmExtraction, recordException, addEvidenceReport, removeEvidenceReport, proveEvidenceReport, registerIpe, setIpeCheck, concludeIpe, clearIpe, setMrc, setSampling, extendSample, resizeSample, setSampleResult, setStepResult, overrideStep, pullStepRun, attestStep, addStepEvidence, setStepInputFile, concludeOperating, overrideOperating, startToeRound, addAttribute, removeAttribute, mapStepWorkflow, setStepEvidenceMode, toggleStepAttest, toggleStepAI, runStepValidation, testAllAttributes, addRequiredFile, renameRequiredFile, removeRequiredFile, uploadRequiredFile, clearRequiredFile, validateReadyAttributes, approveRacmRows, remarkRacmRow, clearRacmReview, bulkTestControls, createAudit, updateAudit, openAuditId, openAudit, closeAudit, racmDocs, addRacmDoc, createRacm, deleteRacm, addLibraryRacms, addComment, resolveDiscussion, submitTask, clearTask, raiseQuery, requestDesignDocs, updateRules, applyRules, updateMateriality, reconcileScope, updateDeficiency, linkRootCause, unlinkRootCause, setGroupConclusion, updateAccount, setExceptionStatus, completeSizing, confirmRating, returnRating, submitPlan, reviewPlan, drawRetestSample, setRetestResult, setRetestCheck, runRetestIra, recordRetest, signOffException, reopenException, updateRemediation, addRemediationEvidence, raiseChallenge, respondToChallenge, markUnableToTest, resolveUnableToTest, escalateUnableToTest, addControl, proposeSampling, signSampling, reviseSampling, signOffAudit, reopenControl, signOffControlWp, returnControl, raiseReviewNote, resolveReviewNote, verifyReviewNote, reopenReviewNote]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
