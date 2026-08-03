import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { racmTemplateForProcesses, requiredDatasetsFor, sampleRefs, seedIcfrEngagement, type SeedMeta } from './mockData';
import { assessSeverity, controlConclusion, formatINR, gradeException, icfrConclusion, isControlLocked, isEngagementLocked, needsRatingConfirmation, parseLooseDate, previewRegrades, sampleSizeGuide, trackResult, validationQA, validationSummary, validationTable, wfRunRef, type RulesPatch } from './helpers';
import type {
  Assertion, Attestation, AuditArchive, AuditFileRecord, AuditRecord, Control, Deficiency, DesignDoc, DesignDocKind, DesignPoint, DiscussionAnchor, DocStatus, FileOrigin,
  DesignJudgements, DesignWaiverReason, EvidenceFile, EvidenceMode, ExceptionStatus, ExecKind, ExecutionEvent, Frequency, HandoffTask, IcfrEngagement,
  DesignBasis, EvidenceType, ExceptionKind, IpeConclusion, PopulationChecks, IpeTest, MaterialityRules, Walkthrough, Nature, OperatingStep, Override, Population, PopulationDefinition, RacmReview, Role, RulesChangeEntry, RunControlOutcome, RunRecord,
  Sampling, SignificantAccount, TestResult, TrackConclusion, RetestRound, UnableToTest,
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
    design: {
      ...c.design,
      conclusion: 'Not tested',
      override: undefined,
      testedBy: null,
      testedAt: null,
      documents: [],
      points: [],
      // The walkthrough walked one transaction from last cycle's period, with the
      // people who were in that room. It cannot speak for this cycle.
      walkthrough: undefined,
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
import { ipeChecklist, ROLE_LABEL } from './types';
import { normaliseProcess, processesForAudit } from './auditScope';

// The five primary tabs — mirrors how other engagements are laid out.
// 'deficiencies' is a TAB now, not a drill-in: deficiency management is a place
// you go, not somewhere you land from an Overview card.
export type SoxTab = 'overview' | 'racm' | 'risks' | 'controls' | 'runs' | 'deficiencies' | 'config';
// 'overview' | 'racm'(card) | 'racm-list'(matrix) | 'risks' | 'register'(=Control Library) | 'runs' | 'config'
// are root-level views; the rest are drill-ins reached from them.
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
  riskDescription: string;
  nature: Nature;
  frequency: Frequency;
  owner: string;
  isKey: boolean;
  assertions: Assertion[];
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
  openControl: (id: string) => void;
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
  // design track
  setDocStatus: (controlId: string, docId: string, status: DocStatus) => void;
  setDesignPoint: (controlId: string, pointId: string, result: TestResult) => void;
  concludeDesign: (controlId: string, conclusion: TrackConclusion) => void;
  overrideDesign: (controlId: string, override: Override | null) => void;
  // design CRUD + validation
  // `custom` names an element the standard kinds don't cover — its title is the
  // name the auditor typed, and the description says what evidence is wanted
  addDesignDoc: (controlId: string, kind: DesignDocKind, custom?: { name: string; description?: string }) => void;
  attachDesignEvidence: (controlId: string, docId: string, fileName: string) => void;
  removeDesignDoc: (controlId: string, docId: string) => void;
  /** Account for a required element that will never arrive — audit-team prepared,
   *  inspected at the client, or not applicable. Recorded with a reason, and it
   *  stops gating the conclusion. */
  waiveDesignDoc: (controlId: string, docId: string, reason: DesignWaiverReason, note: string) => void;
  clearDesignWaiver: (controlId: string, docId: string) => void;
  /** Edit the control's own identity — objective, classification, key judgement,
   *  risk rating. Key/non-key and the rating are agreed with management, never
   *  read off an SOP, so they have to be editable rather than displayed. */
  updateControlMeta: (controlId: string, patch: Pick<Partial<Control>, 'objective' | 'clazz' | 'isKey' | 'riskRating'>) => void;
  /** The design judgements the paper states — 5W+1H coverage, compensating
   *  control, is the frequency right, is the type right. */
  setDesignJudgements: (controlId: string, patch: Partial<DesignJudgements>) => void;
  /** The walkthrough — design tested against one transaction, on the same
   *  attributes the sample will test. */
  startWalkthrough: (controlId: string) => void;
  setWalkthroughAttribute: (controlId: string, stepId: string, result: TestResult) => void;
  setWalkthroughMeta: (controlId: string, patch: Partial<Pick<Walkthrough, 'date' | 'tester' | 'attendees' | 'notes'>>) => void;
  addDesignPoint: (controlId: string, text: string) => void;
  removeDesignPoint: (controlId: string, pointId: string) => void;
  validateDesignPoint: (controlId: string, pointId: string) => void;
  overrideDesignPoint: (controlId: string, pointId: string, override: Override | null) => void;
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
  setPopulationFacts: (controlId: string, patch: Partial<Pick<Population, 'provenance' | 'countConfirmed' | 'expectedCount' | 'countNote' | 'coverageNote'>>) => void;
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
  setIpeCheck: (controlId: string, checkId: string, patch: { result?: TestResult; note?: string }) => void;
  concludeIpe: (controlId: string, conclusion: IpeConclusion) => void;
  /** Unregister the report — the wrong extract was tested, so the work goes with it. */
  clearIpe: (controlId: string) => void;
  setMrc: (controlId: string, isMrc: boolean, threshold?: number) => void;
  updateAccount: (id: string, patch: Partial<SignificantAccount>) => void;
  setSampling: (controlId: string, sampling: Sampling) => void;
  extendSample: (controlId: string, extra: number) => void;
  resizeSample: (controlId: string, size: number) => void;
  setSampleResult: (controlId: string, stepId: string, sampleId: string, result: TestResult) => void;
  setStepResult: (controlId: string, stepId: string, result: TestResult) => void;
  overrideStep: (controlId: string, stepId: string, override: Override | null) => void;
  pullStepRun: (controlId: string, stepId: string) => void;
  attestStep: (controlId: string, stepId: string, note: string, result: 'Pass' | 'Fail') => void;
  addStepEvidence: (controlId: string, stepId: string, fileName: string) => void;
  setStepInputFile: (controlId: string, stepId: string, fileName: string) => void;
  concludeOperating: (controlId: string, conclusion: TrackConclusion) => void;
  overrideOperating: (controlId: string, override: Override | null) => void;
  // operating CRUD + workflow mapping + attest toggle + test-all
  addAttribute: (controlId: string, description: string) => void;
  removeAttribute: (controlId: string, stepId: string) => void;
  mapStepWorkflow: (controlId: string, stepId: string, name: string) => void;
  setStepEvidenceMode: (controlId: string, stepId: string, mode: EvidenceMode) => void;
  toggleStepAttest: (controlId: string, stepId: string, enabled: boolean) => void;
  toggleStepAI: (controlId: string, stepId: string, on: boolean) => void;
  runStepValidation: (controlId: string, stepId: string) => void;
  testAllAttributes: (controlId: string) => void;
  // RACM row review — auditor approval / remark, plus bulk testing
  approveRacmRows: (controlIds: string[]) => void;
  remarkRacmRow: (controlId: string, remark: string) => void;
  clearRacmReview: (controlId: string) => void;
  bulkTestControls: (controlIds: string[]) => void;
  // Audit logs tab — the New audit wizard hands back everything but the
  // stamp (id / by / role / at), which the store adds.
  createAudit: (draft: Omit<AuditRecord, 'id' | 'by' | 'role' | 'at'>) => void;
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
  racmDocs: (EvidenceFile & { process?: string })[];
  addRacmDoc: (fileName: string, process?: string) => void;
  // a RACM here IS a process's set of controls, so creating one brings a new
  // process into scope and seeds its risks & controls from the template
  createRacm: (process: string, sourceFileName?: string) => void;
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
  recordRetest: (id: string, rationale?: string) => void;
  signOffException: (id: string) => void;
  reopenException: (id: string, reason: string) => void;
  updateRemediation: (id: string, patch: Partial<Deficiency['remediation']>) => void;
  addRemediationEvidence: (id: string, fileName: string) => void;
  /** Blocked testing — a status on the control, not an exception. See UnableToTest. */
  markUnableToTest: (controlId: string, track: 'design' | 'operating', reason: string, needed: string) => void;
  resolveUnableToTest: (controlId: string) => void;
  escalateUnableToTest: (controlId: string) => void;
  // create control + engagement-level sign-off
  addControl: (draft: NewControlDraft) => string;
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

const Ctx = createContext<IcfrCtx | null>(null);

export function useIcfr(): IcfrCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useIcfr must be used within IcfrProvider');
  return c;
}

export function IcfrProvider({ children, initialRole = 'auditor', seedMeta }: { children: ReactNode; initialRole?: Role; seedMeta?: SeedMeta }) {
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
  const [racmDocs, setRacmDocs] = useState<(EvidenceFile & { process?: string })[]>([]);
  // Owner mode is a person-lane, not a role-lane: "mine" = this named owner's
  // controls, tasks and exceptions. The picker in the top bar switches personas.
  // Start on an owner who actually has something to do. A hard-coded name lands
  // the owner's hat on an empty queue whenever the seeded exceptions belong to
  // someone else, which reads as "nothing is assigned to me" rather than "you are
  // looking at the wrong person".
  const [meOwner, setMeOwner] = useState(() => {
    const live = eng.deficiencies.find(d => d.status !== 'Closed');
    const owner = live && eng.controls.find(c => c.id === live.controlId)?.owner;
    return owner ?? eng.controls[0]?.owner ?? 'M. Nair · Accounts Payable';
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
  const openControl = useCallback((id: string) => {
    setReturnView(RETURNABLE.includes(view) ? view : null);
    setSelectedControlId(id); setView('dossier');
  }, [view]);
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
  // existing open exception for the same control + track. Severity starts at the
  // floor until likelihood/magnitude are assessed on the exception card.
  const raiseDeficiencyIfIneffective = useCallback((controlId: string, track: 'design' | 'operating') => {
    setEng(prev => {
      const c = prev.controls.find(x => x.id === controlId);
      if (!c) return prev;
      if (trackResult(track === 'design' ? c.design : c.operating) !== 'Ineffective') return prev;
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
        description: failed.length
          ? `${track === 'design' ? 'Design' : 'Operating'} concluded ineffective on ${c.wpRef} — failed: ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? ` +${failed.length - 3} more` : ''}.`
          : `${track === 'design' ? 'Design' : 'Operating'} concluded ineffective on ${c.wpRef}.`,
        // Deliberately blank, not pre-filled with a plausible sentence: the whole
        // exception turns on this, and a default here would be a guess the auditor
        // never made. Step 1 is not complete until it is written.
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
        remediation: { action: '', date: null, owner: c.owner, status: 'Open' },
        status: 'Identified',
      };
      const event: ExecutionEvent = {
        id: uid('ex'), controlId, track, kind: 'exception',
        verb: `raised ${def.id} — severity to assess${prev.rules.autoRoute ? ` · auto-routed to ${c.owner}` : ''}`, by: me, role, at: 'just now',
      };
      return { ...prev, deficiencies: [def, ...prev.deficiencies], executions: [event, ...prev.executions] };
    });
  }, [me, role]);

  const concludeDesign = useCallback<IcfrCtx['concludeDesign']>((controlId, conclusion) => {
    if (role !== 'auditor') return;
    // re-concluding clears a reviewer's return note — the rework happened
    patchControl(controlId, c => ({ ...c, reviewReturn: conclusion === 'Not tested' ? c.reviewReturn : undefined, design: { ...c.design, conclusion, testedBy: me, testedAt: 'just now' } }));
    if (conclusion !== 'Not tested') pushExec(() => ({ controlId, track: 'design', kind: 'conclude', verb: `concluded design ${conclusion.toLowerCase()}`, result: conclusion }));
    if (conclusion === 'Ineffective') raiseDeficiencyIfIneffective(controlId, 'design');
  }, [patchControl, me, role, pushExec, raiseDeficiencyIfIneffective]);

  const overrideDesign = useCallback<IcfrCtx['overrideDesign']>((controlId, override) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({ ...c, design: { ...c.design, override: override ?? undefined } }));
    if (override) pushExec(() => ({ controlId, track: 'design', kind: 'override', verb: 'overrode the design conclusion', result: override.result === 'Effective' ? 'Effective' : 'Ineffective' }));
    if (override?.result === 'Ineffective') raiseDeficiencyIfIneffective(controlId, 'design');
  }, [patchControl, role, pushExec, raiseDeficiencyIfIneffective]);

  const addDesignDoc = useCallback<IcfrCtx['addDesignDoc']>((controlId, kind, custom) => {
    if (role !== 'auditor') return;
    const doc: DesignDoc = custom
      ? { id: uid('dd'), kind: 'Custom', name: custom.name, description: custom.description, status: 'Missing' }
      : { id: uid('dd'), kind, name: `${kind} — to provide`, status: 'Missing' };
    patchControl(controlId, c => ({ ...c, design: { ...c.design, documents: [...c.design.documents, doc] } }));
  }, [patchControl, role]);
  // Attach an evidence file to a design element — the element becomes Evidenced,
  // which is what the evidence-first TOD completeness gate counts. (Hand-merged
  // from main's go-live commit for the evidence-first dossier.)
  const attachDesignEvidence = useCallback<IcfrCtx['attachDesignEvidence']>((controlId, docId, fileName) => {
    if (role === 'reviewer') return;
    patchControl(controlId, c => ({ ...c, design: { ...c.design, documents: c.design.documents.map(d => d.id === docId
      ? { ...d, status: 'Received' as DocStatus, name: fileName, uploadedBy: me, at: 'just now', files: [...(d.files ?? []), { id: uid('f'), name: fileName, kind: fileName.toLowerCase().endsWith('.xlsx') ? 'XLSX' : fileName.toLowerCase().endsWith('.csv') ? 'CSV' : 'PDF', uploadedBy: me, uploadedAt: 'just now' } as EvidenceFile] }
      : d) } }));
    pushExec(prev => { const d = prev.controls.find(c => c.id === controlId)?.design.documents.find(dd => dd.id === docId); return d ? { controlId, track: 'design', kind: 'receive-doc', verb: 'attached evidence', target: d.kind } : null; });
  }, [patchControl, me, role, pushExec]);
  const removeDesignDoc = useCallback<IcfrCtx['removeDesignDoc']>((controlId, docId) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({ ...c, design: { ...c.design, documents: c.design.documents.filter(d => d.id !== docId) } }));
  }, [patchControl, role]);

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
  const addDesignPoint = useCallback<IcfrCtx['addDesignPoint']>((controlId, text) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({ ...c, design: { ...c.design, points: [...c.design.points, { id: uid('dp'), text, result: 'Not tested', workflowId: uid('wf-tod'), workflowName: 'Design walkthrough check' } as DesignPoint] } }));
  }, [patchControl, role]);
  const removeDesignPoint = useCallback<IcfrCtx['removeDesignPoint']>((controlId, pointId) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({ ...c, design: { ...c.design, points: c.design.points.filter(p => p.id !== pointId) } }));
  }, [patchControl, role]);
  const validateDesignPoint = useCallback<IcfrCtx['validateDesignPoint']>((controlId, pointId) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({ ...c, design: { ...c.design, points: c.design.points.map(p => {
      if (p.id !== pointId) return p;
      const willFail = (p.override ? p.override.result : p.result) === 'Fail';
      return { ...p, result: willFail ? 'Fail' : 'Pass', override: undefined, workflowRunRef: 'run · validated · just now', validation: { qa: validationQA(p.text, willFail), at: 'just now' } };
    }) } }));
    pushExec(prev => { const p = prev.controls.find(c => c.id === controlId)?.design.points.find(pt => pt.id === pointId); return p ? { controlId, track: 'design', kind: 'validate', verb: 'validated', target: short(p.text), result: p.result } : null; });
  }, [patchControl, pushExec, role]);
  const overrideDesignPoint = useCallback<IcfrCtx['overrideDesignPoint']>((controlId, pointId, override) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({ ...c, design: { ...c.design, points: c.design.points.map(p => p.id === pointId ? { ...p, override: override ?? undefined } : p) } }));
  }, [patchControl, role]);
  const requestDataByEmail = useCallback<IcfrCtx['requestDataByEmail']>((controlId, docIds, emails) => {
    if (role !== 'auditor') return;
    setEng(prev => {
      const ctrl = prev.controls.find(c => c.id === controlId);
      const kinds = ctrl ? ctrl.design.documents.filter(d => docIds.includes(d.id)).map(d => d.kind) : [];
      const task: HandoffTask = { id: uid('PBC'), type: 'pbc', controlId, title: `Provide design documents (${docIds.length})`, detail: `Requested from ${emails.join(', ')} — ${kinds.join(', ')}.`, assignee: emails[0] ?? 'Risk Owner', assigneeRole: 'risk-owner', raisedBy: me, dueLabel: 'Due in 3d', overdue: false, status: 'open' };
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
    if (role === 'reviewer') return;
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, population } }));
    pushExec(() => ({ controlId, track: 'operating', kind: 'sample',
      verb: `extracted the population — ${population.count.toLocaleString()} instances${population.sourceCount ? ` from ${population.sourceCount.toLocaleString()} rows` : ''}`,
      target: population.criteria ?? population.source }));
  }, [patchControl, pushExec, role]);

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
   * Correct a file's provenance — the ONLY place it can be changed.
   *
   * Two consequences, both required: every control that drew a population off
   * this file now reads the new answer (they hold no copy of it, so that is
   * automatic), and any of those controls that had already CONCLUDED gets a
   * review note. A concluded paper whose evidence quietly changed underneath it
   * is the thing an external reviewer is entitled to be told about, so it is
   * raised rather than silently restated.
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
        return c.operating.population?.sourceFile === name && (concl === 'Effective' || concl === 'Ineffective');
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
    if (role !== 'auditor') return;
    patchControl(controlId, c => (c.operating.population
      ? { ...c, operating: { ...c.operating, population: { ...c.operating.population, locked: { by: me, at: 'just now' } } } }
      : c));
    pushExec(() => ({ controlId, track: 'operating', kind: 'sample', verb: 'locked the population' }));
  }, [patchControl, me, pushExec, role]);

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
          checks: ipeChecklist(meta.reportName).map(k => ({ ...k, id: uid('ipe') })),
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
      return {
        ...c,
        operating: {
          ...c.operating,
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
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, sampling } }));
  }, [patchControl, role]);

  // Any failure means extend the sample — never "small miss, ignore" (handbook).
  const extendSample = useCallback<IcfrCtx['extendSample']>((controlId, extra) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => {
      const s = c.operating.sampling;
      if (!s) return c;
      // Tagged as the extension round: appended to the one list the results are
      // keyed against, but distinguishable on the paper from the original draw.
      const added = sampleRefs(c.process, s.size + extra).slice(s.size).map((ref, i) => ({ id: `s${s.size + i}`, ref, result: 'Not tested' as TestResult, extension: true }));
      return { ...c, operating: { ...c.operating, sampling: { ...s, size: s.size + extra, samples: [...s.samples, ...added], basis: `${s.size + extra} items — extended +${extra} after a failure (a miss is never ignored).` } } };
    });
    pushExec(() => ({ controlId, track: 'operating', kind: 'sample', verb: `extended the sample by ${extra} after a failure`, target: `+${extra} items` }));
  }, [patchControl, pushExec, role]);

  // Revise a drawn sample up or down. Growing appends fresh refs; shrinking keeps
  // the first N items (so results already recorded against them survive) and drops
  // the rest — including their per-attribute results, which would otherwise linger
  // as orphans keyed to sample ids that no longer exist.
  const resizeSample = useCallback<IcfrCtx['resizeSample']>((controlId, size) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => {
      const s = c.operating.sampling;
      if (!s || size < 1 || size === s.size) return c;
      const samples = size > s.size
        ? [...s.samples, ...sampleRefs(c.process, size).slice(s.size).map((ref, i) => ({ id: `s${s.size + i}`, ref, result: 'Not tested' as TestResult }))]
        : s.samples.slice(0, size);
      const kept = new Set(samples.map(x => x.id));
      const steps = c.operating.steps.map(st => st.sampleResults
        ? { ...st, sampleResults: Object.fromEntries(Object.entries(st.sampleResults).filter(([id]) => kept.has(id))) }
        : st);
      return { ...c, operating: { ...c.operating, steps, sampling: { ...s, size, samples, basis: `${size} items — sample size revised by the auditor (judgment documented).` } } };
    });
    pushExec(() => ({ controlId, track: 'operating', kind: 'sample', verb: `revised the sample size to ${size}`, target: `${size} items` }));
  }, [patchControl, pushExec, role]);

  const setStepResult = useCallback<IcfrCtx['setStepResult']>((controlId, stepId, result) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, steps: c.operating.steps.map(s => s.id === stepId ? stampSamples(c, { ...s, result }, result) : s) } }));
  }, [patchControl, role]);

  // Record one attribute's result against ONE drawn sample; the attribute's own
  // result derives from its samples (any fail ⇒ Fail, all pass ⇒ Pass).
  const setSampleResult = useCallback<IcfrCtx['setSampleResult']>((controlId, stepId, sampleId, result) => {
    if (role !== 'auditor') return;
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
  }, [patchControl, role]);

  const overrideStep = useCallback<IcfrCtx['overrideStep']>((controlId, stepId, override) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, steps: c.operating.steps.map(s => s.id === stepId ? { ...s, override: override ?? undefined } : s) } }));
  }, [patchControl, role]);

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
  const createAudit = useCallback((draft: Omit<AuditRecord, 'id' | 'by' | 'role' | 'at'>) => {
    setEng(prev => {
      const audit: AuditRecord = { id: uid('audit'), by: me, role, at: 'just now', ...draft };
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
      const resetIds = new Set(prev.controls.filter(covers).map(c => c.id));
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
        })),
        // Severity is resolved NOW: assessSeverity applies the compensating-control
        // cap against the live engagement, and that engagement is about to change.
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
            ? { ...a, archive, signoff: { ...a.signoff, icfrConclusion: icfrConclusion(prev) } }
            : a)),
        ],
        controls: prev.controls.map(c => (resetIds.has(c.id) ? untested(c) : c)),
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
  const [openAuditId, setOpenAuditId] = useState<string | null>(null);
  const openAudit = useCallback((auditId: string) => {
    setOpenAuditId(auditId);
    setTabState('overview');
    setView('overview');
  }, []);

  // Land on the exception itself. openAudit resets the tab by design, so the tab
  // is set AFTER it rather than alongside — otherwise the reset wins and the
  // reader arrives on the audit dashboard wondering what they clicked.
  const openDeficiency = useCallback<IcfrCtx['openDeficiency']>((defId) => {
    setFocusDefId(defId);
    const target = eng.deficiencies.find(d => d.id === defId);
    const owning = target && eng.audits.find(a => a.controlIds?.includes(target.controlId));
    if (owning && owning.id !== openAuditId) { openAudit(owning.id); setTabState('deficiencies'); return; }
    if (openAuditId) setTabState('deficiencies'); else setView('deficiencies');
  }, [eng.deficiencies, eng.audits, openAuditId, openAudit]);
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
    outcome: c.design.points.some(p => p.result === 'Fail') || c.operating.steps.some(s => s.result === 'Fail') ? 'Ineffective' : 'Effective',
    checks: c.design.points.length + c.operating.steps.length,
  });

  const pullStepRun = useCallback<IcfrCtx['pullStepRun']>((controlId, stepId) => {
    if (role !== 'auditor') return;
    patchStep(controlId, stepId, (s, c) => {
      const res = s.result === 'Not tested' ? 'Pass' : s.result;
      return stampSamples(c, { ...s, workflowRunRef: `${wfRunRef(controlId + s.id, res === 'Fail')} · just now`, result: res }, res);
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
  }, [patchStep, pushExec, pushRun, role]);

  // Self-attestation stays a first-line voice — owner or auditor, never the reviewer.
  const attestStep = useCallback<IcfrCtx['attestStep']>((controlId, stepId, note, result) => {
    if (role === 'reviewer') return;
    patchStep(controlId, stepId, (s, c) => {
      const att: Attestation = { result, note, by: me, role, at: 'just now', evidence: s.attestation?.evidence ?? [] };
      return stampSamples(c, { ...s, attestEnabled: true, attestation: att, result }, result);   // a manual attestation IS the attribute's result
    });
    pushExec(prev => { const s = prev.controls.find(c => c.id === controlId)?.operating.steps.find(st => st.id === stepId); return s ? { controlId, track: 'operating', kind: 'attest', verb: `attested ${result.toLowerCase()}`, target: s.code, result } : null; });
  }, [patchStep, me, role, pushExec]);

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

  // Attributes are structure, not testing — the control's owner knows its shape
  // as well as the auditor does, so both roles can define one and map its
  // evidence workflow. Only a reviewer, who signs off rather than builds, is shut out.
  const addAttribute = useCallback<IcfrCtx['addAttribute']>((controlId, description) => {
    if (role === 'reviewer') return;
    patchControl(controlId, c => {
      const step: OperatingStep = { id: uid('os'), code: `${c.wpRef}.${c.operating.steps.length + 1}`, description, assertion: 'Accuracy', precision: 'Per item', procedures: ['Inspection'], result: 'Not tested' };
      return { ...c, operating: { ...c.operating, steps: [...c.operating.steps, step] } };
    });
  }, [patchControl, role]);
  const removeAttribute = useCallback<IcfrCtx['removeAttribute']>((controlId, stepId) => {
    if (role === 'reviewer') return;
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, steps: c.operating.steps.filter(s => s.id !== stepId) } }));
  }, [patchControl, role]);
  const mapStepWorkflow = useCallback<IcfrCtx['mapStepWorkflow']>((controlId, stepId, name) => {
    if (role === 'reviewer') return;
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
  const runStepValidation = useCallback<IcfrCtx['runStepValidation']>((controlId, stepId) => {
    if (role !== 'auditor') return;
    patchStep(controlId, stepId, (s, c) => {
      const willFail = (s.override ? s.override.result : s.result) === 'Fail';
      const res: TestResult = willFail ? 'Fail' : 'Pass';
      return stampSamples(c, { ...s, result: res, workflowRunRef: 'Ask IRA · validated · just now', validation: { result: res, qa: validationQA(s.description, willFail), summary: validationSummary(s.description, willFail, controlId + s.id, c.operating.sampling?.size), table: validationTable(willFail, controlId + s.id), fileName: s.inputFile?.name, at: 'just now' } }, res);
    });
    pushExec(prev => { const s = prev.controls.find(c => c.id === controlId)?.operating.steps.find(st => st.id === stepId); return s ? { controlId, track: 'operating', kind: 'validate', verb: 'validated against file', target: s.code, result: s.result } : null; });
    pushRun(prev => {
      const c = prev.controls.find(cc => cc.id === controlId);
      const s = c?.operating.steps.find(st => st.id === stepId);
      if (!c || !s) return null;
      return {
        kind: 'ai-validation', label: `AI validation — ${c.wpRef} · ${s.code}`,
        detail: s.inputFile ? `Checked against ${s.inputFile.name}` : 'Checked against attached evidence',
        controls: [{ controlId: c.id, wpRef: c.wpRef, description: c.description, outcome: s.result === 'Fail' ? 'Ineffective' : 'Effective', checks: 1 }],
      };
    });
  }, [patchStep, pushExec, pushRun, role]);
  const testAllAttributes = useCallback<IcfrCtx['testAllAttributes']>((controlId) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, steps: c.operating.steps.map(s => {
      const fail = s.result === 'Fail' || s.override?.result === 'Fail';
      const res: TestResult = fail ? 'Fail' : 'Pass';
      const wantsValidation = s.aiValidation || s.evidenceMode === 'ai' || !!s.inputFile;
      return stampSamples(c, {
        ...s, result: res,
        workflowRunRef: s.workflowName ? (s.workflowRunRef ?? `${wfRunRef(controlId + s.id, fail)} · just now`) : s.workflowRunRef,
        validation: wantsValidation ? (s.validation ?? { result: res, qa: validationQA(s.description, fail), summary: validationSummary(s.description, fail, controlId + s.id, c.operating.sampling?.size), table: validationTable(fail, controlId + s.id), fileName: s.inputFile?.name, at: 'just now' }) : s.validation,
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
  }, [patchControl, pushExec, pushRun, role]);

  const concludeOperating = useCallback<IcfrCtx['concludeOperating']>((controlId, conclusion) => {
    if (role !== 'auditor') return;
    // re-concluding clears a reviewer's return note — the rework happened
    patchControl(controlId, c => ({ ...c, reviewReturn: conclusion === 'Not tested' ? c.reviewReturn : undefined, operating: { ...c.operating, conclusion, testedBy: me, testedAt: 'just now' } }));
    if (conclusion !== 'Not tested') pushExec(() => ({ controlId, track: 'operating', kind: 'conclude', verb: `concluded operating ${conclusion.toLowerCase()}`, result: conclusion }));
    if (conclusion === 'Ineffective') raiseDeficiencyIfIneffective(controlId, 'operating');
  }, [patchControl, me, role, pushExec, raiseDeficiencyIfIneffective]);

  const overrideOperating = useCallback<IcfrCtx['overrideOperating']>((controlId, override) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, override: override ?? undefined } }));
    if (override) pushExec(() => ({ controlId, track: 'operating', kind: 'override', verb: 'overrode the operating conclusion', result: override.result === 'Effective' ? 'Effective' : 'Ineffective' }));
    if (override?.result === 'Ineffective') raiseDeficiencyIfIneffective(controlId, 'operating');
  }, [patchControl, role, pushExec, raiseDeficiencyIfIneffective]);

  // ── RACM row review + bulk testing ────────────────────────────────────────────
  const approveRacmRows = useCallback<IcfrCtx['approveRacmRows']>((controlIds) => {
    const ids = new Set(controlIds);
    setEng(prev => ({ ...prev, controls: prev.controls.map(c => ids.has(c.id) ? { ...c, racmReview: { status: 'Approved', by: me, at: 'just now' } as RacmReview } : c) }));
  }, [me]);

  const remarkRacmRow = useCallback<IcfrCtx['remarkRacmRow']>((controlId, remark) => {
    setEng(prev => ({ ...prev, controls: prev.controls.map(c => c.id === controlId ? { ...c, racmReview: { status: 'Remark', remark, by: me, at: 'just now' } as RacmReview } : c) }));
  }, [me]);

  const clearRacmReview = useCallback<IcfrCtx['clearRacmReview']>((controlId) => {
    setEng(prev => ({ ...prev, controls: prev.controls.map(c => c.id === controlId ? { ...c, racmReview: undefined } : c) }));
  }, []);

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
          return { ...p, result: (willFail ? 'Fail' : 'Pass') as TestResult, override: undefined, workflowRunRef: 'run · validated · just now', validation: { qa: validationQA(p.text, willFail), at: 'just now' } };
        });
        const steps = c.operating.steps.map(s => {
          const fail = s.result === 'Fail' || s.override?.result === 'Fail';
          const res: TestResult = fail ? 'Fail' : 'Pass';
          const wantsValidation = s.aiValidation || s.evidenceMode === 'ai' || !!s.inputFile;
          return stampSamples(c, {
            ...s, result: res,
            workflowRunRef: s.workflowName ? (s.workflowRunRef ?? `${wfRunRef(c.id + s.id, fail)} · just now`) : s.workflowRunRef,
            validation: wantsValidation ? (s.validation ?? { result: res, qa: validationQA(s.description, fail), summary: validationSummary(s.description, fail, c.id + s.id, c.operating.sampling?.size), table: validationTable(fail, c.id + s.id), fileName: s.inputFile?.name, at: 'just now' }) : s.validation,
          }, res);
        });
        const designConcl: TrackConclusion = points.some(p => p.result === 'Fail') ? 'Ineffective' : 'Effective';
        const opConcl: TrackConclusion = steps.some(s => s.result === 'Fail') ? 'Ineffective' : 'Effective';
        const checks = points.length + steps.length;
        if (checks > 0) execs.push({
          id: uid('ex'), controlId: c.id, track: 'operating', kind: 'test-all', verb: 'bulk tested design & operating',
          target: `${checks} check${checks === 1 ? '' : 's'}`,
          result: (points.length && designConcl === 'Ineffective') || (steps.length && opConcl === 'Ineffective') ? 'Ineffective' : 'Effective',
          by: me, role, at: 'just now',
        });
        return {
          ...c,
          design: points.length ? { ...c.design, points, conclusion: designConcl, override: undefined, testedBy: me, testedAt: 'just now' } : c.design,
          operating: steps.length ? { ...c.operating, steps, conclusion: opConcl, override: undefined, testedBy: me, testedAt: 'just now' } : c.operating,
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
  }, [me, role, raiseDeficiencyIfIneffective]);

  const addRacmDoc = useCallback<IcfrCtx['addRacmDoc']>((fileName, process) => {
    const lower = fileName.toLowerCase();
    const kind: EvidenceFile['kind'] = lower.endsWith('.csv') ? 'CSV' : lower.endsWith('.xlsx') || lower.endsWith('.xls') ? 'XLSX' : lower.endsWith('.png') || lower.endsWith('.jpg') ? 'IMG' : 'PDF';
    setRacmDocs(prev => [{ id: uid('rd'), name: fileName, kind, uploadedBy: me, uploadedAt: 'just now', process }, ...prev]);
  }, [me]);

  // Creating a RACM brings a process into scope: the template seeds its risks
  // and controls (the same primitive reconcileScope uses for newly-scoped
  // processes), and the workbook / SOP that produced it is pinned to the new
  // matrix as its source document. A process that already has a RACM is a
  // no-op — the landing lists one RACM per process.
  const createRacm = useCallback<IcfrCtx['createRacm']>((process, sourceFileName) => {
    if (role !== 'auditor') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      if (prev.controls.some(c => c.process === process)) return prev;
      return { ...prev, controls: [...prev.controls, ...racmTemplateForProcesses([process], 'fresh')] };
    });
    if (sourceFileName) addRacmDoc(sourceFileName, process);
  }, [role, addRacmDoc]);

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
      const task = prev.tasks.find(t => t.id === taskId);
      let controls = prev.controls;
      // a submitted PBC marks the requested design documents received
      if (task && task.type === 'pbc') {
        controls = prev.controls.map(c => c.id === task.controlId
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
      const ids = new Set(controlIds);
      const newTasks: HandoffTask[] = [];
      const newExecs: ExecutionEvent[] = [];
      const controls = prev.controls.map(c => {
        if (!ids.has(c.id)) return c;
        // A waived element is not chased: the audit team wrote it, the client
        // holds it, or there is nothing to hold. Asking for it anyway is noise.
        const missing = c.design.documents.filter(d => d.status === 'Missing' && !d.waiver);
        if (missing.length) {
          newTasks.push({ id: `PBC-${prev.tasks.length + newTasks.length + 1}`, type: 'pbc', controlId: c.id, title: `Provide design documents (${missing.length})`, detail: `Needed for TOD: ${missing.map(d => d.kind).join(', ')}.`, assignee: c.owner, assigneeRole: 'risk-owner', raisedBy: me, dueLabel: 'Due in 3d', overdue: false, status: 'open' });
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
      const after = { ...before, ...patch };
      const next = { ...prev, deficiencies: prev.deficiencies.map(d => (d.id === id ? after : d)) };
      const g0 = gradeException(before, prev).grade;
      const g1 = gradeException(after, next).grade;
      if (g0 === g1) return next;
      const event: ExecutionEvent = {
        id: uid('ex'), controlId: before.controlId, track: before.track, kind: 'exception',
        verb: `re-graded ${id}`, from: g0, to: g1, by: me, role, at: 'just now',
        rationale: 'Severity inputs changed — the engine recomputed.',
      };
      // A grade that has moved is no longer the one the reviewer confirmed.
      const cleared = before.ratingConfirm && needsRatingConfirmation(g1)
        ? next.deficiencies.map(d => (d.id === id ? { ...d, ratingConfirm: undefined, status: 'Rating review' as const } : d))
        : next.deficiencies;
      return { ...next, deficiencies: cleared, executions: [event, ...next.executions] };
    });
  }, [me, role]);

  // ─── Step 2 → 3 · the rating leaves the auditor's hands ───────────────────────
  // Below significant it goes straight to the owner to plan. Significant or worse
  // parks for the reviewer first: a wrong material weakness must not set weeks of
  // remediation running, and it is cheaper to argue about the grade than to undo
  // a fix built on it.
  const completeSizing = useCallback<IcfrCtx['completeSizing']>((id) => {
    if (role !== 'auditor') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const target = prev.deficiencies.find(d => d.id === id);
      if (!target || target.status !== 'Identified') return prev;
      if (!target.rootCause.trim()) return prev;               // step 1 is not done
      const grade = gradeException(target, prev).grade;
      const next: ExceptionStatus = needsRatingConfirmation(grade) && !target.ratingConfirm ? 'Rating review' : 'Planning';
      const event: ExecutionEvent = {
        id: uid('ex'), controlId: target.controlId, track: target.track, kind: 'exception',
        verb: next === 'Rating review' ? `sent ${id} for rating confirmation` : `handed ${id} to ${target.remediation.owner} to plan`,
        from: 'Identified', to: next, result: undefined, by: me, role, at: 'just now',
        rationale: `Graded ${grade}.`,
      };
      return {
        ...prev,
        deficiencies: prev.deficiencies.map(d => (d.id === id ? { ...d, status: next, ratingReturn: undefined } : d)),
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
  const reconcileScope = useCallback<IcfrCtx['reconcileScope']>((processes) => {
    setEng(prev => {
      const want = new Set(processes);
      const have = new Set(prev.controls.map(c => c.process));
      const kept = prev.controls.filter(c => want.has(c.process));
      const missing = processes.filter(p => !have.has(p));
      return { ...prev, controls: missing.length ? [...kept, ...racmTemplateForProcesses(missing, 'fresh')] : kept };
    });
  }, []);
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
      if (!changes.length) return prev;
      const entry: RulesChangeEntry = {
        id: uid('rc'), changes, regraded: previewRegrades(prev, patch),
        reason, by: me, at: 'just now',
      };
      return {
        ...prev,
        materiality: patch.materiality ?? prev.materiality,
        performanceMateriality: patch.performanceMateriality ?? prev.performanceMateriality,
        rules: { ...prev.rules, clearlyTrivial: patch.clearlyTrivial ?? prev.rules.clearlyTrivial, sdBandPct: patch.sdBandPct ?? prev.rules.sdBandPct },
        rulesLog: [entry, ...prev.rulesLog],
      };
    });
  }, [me, role]);
  // Lifecycle moves: reviewer only closes (below); submitting the fix for retest
  // is the owner's declaration — the auditor can't call the owner's fix done.
  // Starting remediation marks the plan in progress; submitting marks it done.
  const setExceptionStatus = useCallback<IcfrCtx['setExceptionStatus']>((id, status) => {
    if (role === 'reviewer') return;
    if (status === 'Retest' && role !== 'risk-owner') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const target = prev.deficiencies.find(d => d.id === id);
      if (!target || target.status === status) return prev;
      // every lifecycle move carries its actor + time into the shared trail
      const event: ExecutionEvent = {
        id: uid('ex'), controlId: target.controlId, track: target.track, kind: 'exception',
        verb: status === 'Remediation' ? `started remediation on ${id}` : status === 'Retest' ? `submitted the fix for retest (${id})` : `moved ${id} to ${status.toLowerCase()}`,
        by: me, role, at: 'just now',
      };
      return {
        ...prev,
        deficiencies: prev.deficiencies.map(d => {
          if (d.id !== id) return d;
          const remStatus = status === 'Remediation' ? 'In progress' as const : status === 'Retest' ? 'Done' as const : d.remediation.status;
          return { ...d, status, remediation: { ...d.remediation, status: remStatus } };
        }),
        // submitting the fix also clears the owner's remediation reminder — one
        // declaration, both surfaces agree (portal checklist ↔ exceptions page)
        tasks: status === 'Retest'
          ? prev.tasks.map(t => t.type === 'remediation' && t.controlId === target.controlId && t.status === 'open' ? { ...t, status: 'cleared' as const } : t)
          : prev.tasks,
        executions: [event, ...prev.executions],
      };
    });
  }, [me, role]);
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
      const c = prev.controls.find(x => x.id === target.controlId);
      if (!c) return prev;
      // The same attributes, carried over verbatim — a retest that invents its own
      // is not a retest of anything.
      const attributes = c.operating.steps.map(s => ({ code: s.code, description: s.description }));
      const size = sampleSizeGuide(c).suggested;
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

  // A passed retest never closes itself — it parks at 'Awaiting reviewer'. Only
  // the auditor records retest results; the owner never tests their own fix. A
  // failure sends the plan back to step 3 with the auditor's rationale attached,
  // where the owner can read it, and bumps the loop counter.
  const recordRetest = useCallback<IcfrCtx['recordRetest']>((id, rationale) => {
    if (role !== 'auditor') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const target = prev.deficiencies.find(d => d.id === id);
      if (!target || target.status !== 'Retest' || !target.retestDraft) return prev;
      const draft = target.retestDraft;
      const marks = draft.samples.flatMap(s => draft.attributes.map(a => draft.results[s.id]?.[a.code] ?? 'Not tested'));
      if (marks.some(m => m === 'Not tested')) return prev;             // finish the grid first
      const result: 'Pass' | 'Fail' = marks.includes('Fail') ? 'Fail' : 'Pass';
      if (result === 'Fail' && !rationale?.trim()) return prev;         // the owner has to be told why
      const round: RetestRound = { ...draft, result, rationale: rationale?.trim(), by: me, at: 'just now' };
      const to: ExceptionStatus = result === 'Pass' ? 'Awaiting reviewer' : 'Planning';
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
          // A failure reopens the plan, and the plan's own verdict goes with it —
          // the owner is writing a new one, not resubmitting the rejected one.
          planReview: result === 'Pass' ? d.planReview : undefined,
          planSubmitted: result === 'Pass' ? d.planSubmitted : undefined,
          remediation: { ...d.remediation, status: result === 'Pass' ? 'Done' : 'Open' },
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
      return { ...d, remediation: { ...d.remediation, ...patch } };
    }) }));
  }, [role]);
  const addRemediationEvidence = useCallback<IcfrCtx['addRemediationEvidence']>((id, fileName) => {
    if (role !== 'risk-owner') return;
    setEng(prev => isEngagementLocked(prev) ? prev : ({ ...prev, deficiencies: prev.deficiencies.map(d => {
      if (d.id !== id) return d;
      const file: EvidenceFile = { id: uid('f'), name: fileName, kind: fileName.endsWith('.xlsx') ? 'XLSX' : 'PDF', uploadedBy: me, uploadedAt: 'just now' };
      return { ...d, remediation: { ...d.remediation, evidence: [...(d.remediation.evidence ?? []), file] } };
    }) }));
  }, [me, role]);
  // Four-eyes: only the reviewer hat closes, and never the person who ran the retest.
  const signOffException = useCallback<IcfrCtx['signOffException']>((id) => {
    if (role !== 'reviewer') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const target = prev.deficiencies.find(d => d.id === id);
      if (!target || target.status !== 'Awaiting reviewer' || (target.retest && target.retest.by === me)) return prev;
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

  // A closed exception can come back — auditor or reviewer, reason required. It
  // returns to Remediation (the fix must be re-proven); the stale retest clears.
  const reopenException = useCallback<IcfrCtx['reopenException']>((id, reason) => {
    if (role === 'risk-owner') return;
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
      if (!c || c.unableToTest) return prev;
      const block: UnableToTest = { track, reason: reason.trim(), needed: needed.trim(), raisedBy: me, raisedAt: 'just now' };
      const task: HandoffTask = {
        id: `UTT-${prev.tasks.length + 1}`, type: 'pbc', controlId,
        title: `Testing blocked on ${c.wpRef} — ${short(needed, 60)}`,
        detail: reason.trim(), assignee: c.owner, assigneeRole: 'risk-owner',
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
      if (!c?.unableToTest || c.unableToTest.convertedTo) return prev;
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
            [block.track]: { ...x[block.track], conclusion: 'Ineffective' as TrackConclusion, testedBy: me, testedAt: 'just now' },
          } : x)),
        deficiencies: [def, ...prev.deficiencies],
        executions: [event, ...prev.executions],
      };
    });
  }, [me, role]);

  // The only way back into a concluded control: the auditor reopens it with a
  // reason. Results stay; both tracks' conclusions clear; the trail records why.
  const reopenControl = useCallback<IcfrCtx['reopenControl']>((controlId, reason) => {
    if (role !== 'auditor') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const target = prev.controls.find(c => c.id === controlId);
      if (!target || !isControlLocked(target)) return prev;
      const event: ExecutionEvent = {
        id: uid('ex'), controlId, track: 'design', kind: 'reopen',
        verb: 'reopened the control', target: reason ? short(reason, 80) : undefined,
        by: me, role, at: 'just now',
      };
      return {
        ...prev,
        controls: prev.controls.map(c => c.id === controlId ? {
          ...c,
          design: { ...c.design, conclusion: 'Not tested', override: undefined, testedBy: null, testedAt: null },
          operating: { ...c.operating, conclusion: 'Not tested', override: undefined, testedBy: null, testedAt: null },
          wpSignoff: undefined, // a reopened control's paper is no longer the signed one
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
      if (!target || !isControlLocked(target)) return prev;               // only a concluded control's paper can be signed
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
          design: { ...c.design, conclusion: 'Not tested', override: undefined, testedBy: null, testedAt: null },
          operating: { ...c.operating, conclusion: 'Not tested', override: undefined, testedBy: null, testedAt: null },
          wpSignoff: undefined,
          reviewReturn: { reason, by: me, at: 'just now' },
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
    const idBase = inProc[0]?.id.replace(/-\d+$/, '') ?? `${wpPrefix}-C`;
    let id = `${idBase}-${String(next).padStart(2, '0')}`;
    if (eng.controls.some(c => c.id === id)) id = uid(idBase);
    const control: Control = {
      id, wpRef, description: draft.description, process: draft.process,
      controlActivity: draft.controlActivity?.trim() || undefined,
      subProcess: draft.subProcess.trim() || 'General',
      nature: draft.nature, type: 'Preventive', frequency: draft.frequency,
      isKey: draft.isKey, precision: draft.description, owner: draft.owner,
      riskId: draft.riskId, riskDescription: draft.riskDescription,
      assertions: draft.assertions.length ? draft.assertions : ['Accuracy'],
      design: {
        documents: [
          { id: uid('dd'), kind: 'Process narrative', name: 'Process narrative — to provide', status: 'Missing' },
          { id: uid('dd'), kind: 'Control description', name: 'Control description — to provide', status: 'Missing' },
        ],
        points: [], conclusion: 'Not tested', testedBy: null, testedAt: null,
      },
      operating: { method: 'Manual', steps: [], conclusion: 'Not tested', testedBy: null, testedAt: null },
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
    setEng(prev => {
      if (step === 'reviewer' && prev.reviewer === prev.preparer) return prev;
      const idx = prev.audits.findIndex(a => a.id === openAuditId);
      if (idx < 0) return prev;
      const a = prev.audits[idx]!;
      // A concluded audit's archive is history; it cannot be re-signed.
      if (a.archive) return prev;
      const signoff = {
        ...a.signoff,
        ...(step === 'preparer'
          ? { preparer: { by: prev.preparer, at: 'just now' } }
          : { reviewer: { by: prev.reviewer, at: 'just now' } }),
        icfrConclusion: icfrConclusion(prev),
      };
      return { ...prev, audits: prev.audits.map((x, i) => (i === idx ? { ...x, signoff } : x)) };
    });
  }, [openAuditId]);

  const value = useMemo<IcfrCtx>(() => ({
    eng, role, tab, view, selectedControlId, racmEditor, me, meOwner, setMeOwner, racmProcess,
    setRole: changeRole, setTab, setView, openRacmMatrix, openRacmEditor, openControl, openDeficiency, focusDefId, clearFocusDef, back, returnView,
    registerPreset, openRegister, clearRegisterPreset,
    setDocStatus, setDesignPoint, concludeDesign, overrideDesign,
    addDesignDoc, attachDesignEvidence, removeDesignDoc, waiveDesignDoc, clearDesignWaiver, updateControlMeta, setDesignJudgements, startWalkthrough, setWalkthroughAttribute, setWalkthroughMeta, addDesignPoint, removeDesignPoint, validateDesignPoint, overrideDesignPoint, requestDataByEmail,
    setPointEvidenceType, setStepEvidenceType, setDesignBasis,
    setPopulation, setPopulationDefinition, clearPopulation, setPopulationCheck, setPopulationFacts, registerFile, setFileOrigin, lockPopulation, lockAttributes, confirmExtraction, recordException,
    addEvidenceReport, removeEvidenceReport, proveEvidenceReport,
    registerIpe, setIpeCheck, concludeIpe, clearIpe, setMrc, setSampling, extendSample, resizeSample, setSampleResult, setStepResult, overrideStep, pullStepRun, attestStep, addStepEvidence, setStepInputFile, concludeOperating, overrideOperating,
    addAttribute, removeAttribute, mapStepWorkflow, setStepEvidenceMode, toggleStepAttest, toggleStepAI, runStepValidation, testAllAttributes,
    approveRacmRows, remarkRacmRow, clearRacmReview, bulkTestControls,
    createAudit, updateAudit, openAuditId, openAudit, closeAudit, racmDocs, addRacmDoc, createRacm,
    addComment, resolveDiscussion,
    submitTask, clearTask, raiseQuery, requestDesignDocs,
    updateRules, applyRules, updateMateriality, reconcileScope, updateDeficiency, updateAccount, setExceptionStatus, completeSizing, confirmRating, returnRating, submitPlan, reviewPlan, drawRetestSample, setRetestResult, recordRetest, signOffException, reopenException, updateRemediation, addRemediationEvidence, markUnableToTest, resolveUnableToTest, escalateUnableToTest,
    addControl, signOffAudit, reopenControl, signOffControlWp, returnControl,
    raiseReviewNote, resolveReviewNote, verifyReviewNote, reopenReviewNote,
  }), [eng, role, tab, view, selectedControlId, racmEditor, me, meOwner, racmProcess, changeRole, setTab, openRacmMatrix, openRacmEditor, openControl, openDeficiency, focusDefId, clearFocusDef, back, returnView, registerPreset, openRegister, clearRegisterPreset, setDocStatus, setDesignPoint, concludeDesign, overrideDesign, addDesignDoc, attachDesignEvidence, removeDesignDoc, waiveDesignDoc, clearDesignWaiver, updateControlMeta, setDesignJudgements, startWalkthrough, setWalkthroughAttribute, setWalkthroughMeta, addDesignPoint, removeDesignPoint, validateDesignPoint, overrideDesignPoint, requestDataByEmail, setPointEvidenceType, setStepEvidenceType, setDesignBasis, setPopulation, setPopulationDefinition, clearPopulation, setPopulationCheck, setPopulationFacts, registerFile, setFileOrigin, lockPopulation, lockAttributes, confirmExtraction, recordException, addEvidenceReport, removeEvidenceReport, proveEvidenceReport, registerIpe, setIpeCheck, concludeIpe, clearIpe, setMrc, setSampling, extendSample, resizeSample, setSampleResult, setStepResult, overrideStep, pullStepRun, attestStep, addStepEvidence, setStepInputFile, concludeOperating, overrideOperating, addAttribute, removeAttribute, mapStepWorkflow, setStepEvidenceMode, toggleStepAttest, toggleStepAI, runStepValidation, testAllAttributes, approveRacmRows, remarkRacmRow, clearRacmReview, bulkTestControls, createAudit, updateAudit, openAuditId, openAudit, closeAudit, racmDocs, addRacmDoc, createRacm, addComment, resolveDiscussion, submitTask, clearTask, raiseQuery, requestDesignDocs, updateRules, applyRules, updateMateriality, reconcileScope, updateDeficiency, updateAccount, setExceptionStatus, completeSizing, confirmRating, returnRating, submitPlan, reviewPlan, drawRetestSample, setRetestResult, recordRetest, signOffException, reopenException, updateRemediation, addRemediationEvidence, markUnableToTest, resolveUnableToTest, escalateUnableToTest, addControl, signOffAudit, reopenControl, signOffControlWp, returnControl, raiseReviewNote, resolveReviewNote, verifyReviewNote, reopenReviewNote]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
