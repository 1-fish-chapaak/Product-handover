import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { requiredDatasetsFor, sampleRefs, seedIcfrEngagement, type SeedMeta } from './mockData';
import { formatINR, icfrConclusion, isControlLocked, isEngagementLocked, previewRegrades, trackResult, validationQA, validationSummary, validationTable, wfRunRef, type RulesPatch } from './helpers';
import type {
  Assertion, Attestation, Control, Deficiency, DesignDoc, DesignDocKind, DesignPoint, DiscussionAnchor, DocStatus,
  EvidenceFile, EvidenceMode, ExceptionStatus, ExecKind, ExecutionEvent, Frequency, HandoffTask, IcfrEngagement,
  MaterialityRules, Nature, OperatingStep, Override, Population, RacmReview, Role, RulesChangeEntry, RunControlOutcome, RunRecord,
  Sampling, SignificantAccount, TestResult, TrackConclusion,
} from './types';

let _uid = 0;
const uid = (p: string) => `${p}-${(++_uid).toString(36)}`;
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
import { ROLE_LABEL } from './types';

// The five primary tabs — mirrors how other engagements are laid out.
export type SoxTab = 'overview' | 'racm' | 'risks' | 'controls' | 'runs';
// 'overview' | 'racm'(card) | 'racm-list'(matrix) | 'risks' | 'register'(=Control Library) | 'runs'
// are root-level views; the rest are drill-ins reached from them.
type View = 'overview' | 'racm' | 'racm-list' | 'racm-editor' | 'risks' | 'register' | 'runs' | 'dossier' | 'deficiencies' | 'scope' | 'handoffs';
export interface RacmEditorMeta { name: string; process?: string }

const TAB_ROOT: Record<SoxTab, View> = { overview: 'overview', racm: 'racm', risks: 'risks', controls: 'register', runs: 'runs' };

/** What a drill-in can return to — everything except the drill-ins themselves. */
const RETURNABLE: View[] = ['overview', 'racm', 'racm-list', 'risks', 'register', 'runs', 'deficiencies', 'scope', 'handoffs'];

/** The create-control form's payload — everything else on the Control is derived. */
export interface NewControlDraft {
  description: string;
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
  addDesignDoc: (controlId: string, kind: DesignDocKind) => void;
  attachDesignEvidence: (controlId: string, docId: string, fileName: string) => void;
  removeDesignDoc: (controlId: string, docId: string) => void;
  addDesignPoint: (controlId: string, text: string) => void;
  removeDesignPoint: (controlId: string, pointId: string) => void;
  validateDesignPoint: (controlId: string, pointId: string) => void;
  overrideDesignPoint: (controlId: string, pointId: string, override: Override | null) => void;
  requestDataByEmail: (controlId: string, docIds: string[], emails: string[]) => void;
  // operating track
  setPopulation: (controlId: string, population: Population) => void;
  validateIpe: (controlId: string) => void;
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
  // RACM / SOP source documents uploaded on the RACM page
  // an uploaded RACM/SOP belongs to ONE process's matrix (a RACM is per-process);
  // docs without a process are legacy engagement-wide pins and show everywhere
  racmDocs: (EvidenceFile & { process?: string })[];
  addRacmDoc: (fileName: string, process?: string) => void;
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
  // deficiencies / exception lifecycle
  updateDeficiency: (id: string, patch: Partial<Deficiency>) => void;
  setExceptionStatus: (id: string, status: ExceptionStatus) => void;
  recordRetest: (id: string, result: 'Pass' | 'Fail') => void;
  signOffException: (id: string) => void;
  reopenException: (id: string, reason: string) => void;
  updateRemediation: (id: string, patch: Partial<Deficiency['remediation']>) => void;
  addRemediationEvidence: (id: string, fileName: string) => void;
  // create control + engagement-level sign-off
  addControl: (draft: NewControlDraft) => string;
  signOffEngagement: (step: 'preparer' | 'reviewer') => void;
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
  // testing period — interim vs year-end, and the roll-forward that moves between them
  togglePeriod: () => void;
  rollForward: () => void;
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
  const [meOwner, setMeOwner] = useState('M. Nair · Accounts Payable');

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
      const def: Deficiency = {
        id: `DEF-${String(next).padStart(3, '0')}`,
        controlId, track,
        description: failed.length
          ? `${track === 'design' ? 'Design' : 'Operating'} concluded ineffective on ${c.wpRef} — failed: ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? ` +${failed.length - 3} more` : ''}.`
          : `${track === 'design' ? 'Design' : 'Operating'} concluded ineffective on ${c.wpRef}.`,
        rootCause: 'To be assessed — capture why the control failed.',
        likelihood: 'Reasonably possible',
        magnitude: 0,
        mwIndicators: [],
        compensatingControlId: undefined,
        aggregationGroup: c.process,
        // Auto-routing (Materiality & scope rule): on ⇒ the exception lands straight
        // in the owner's remediation lane; off ⇒ it waits at Identified for routing.
        remediation: { action: 'To be agreed with the control owner.', date: null, owner: c.owner, status: prev.rules.autoRoute ? 'In progress' : 'Open' },
        status: prev.rules.autoRoute ? 'Remediation' : 'Identified',
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

  const addDesignDoc = useCallback<IcfrCtx['addDesignDoc']>((controlId, kind) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({ ...c, design: { ...c.design, documents: [...c.design.documents, { id: uid('dd'), kind, name: `${kind} — to provide`, status: 'Missing' } as DesignDoc] } }));
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

  // ── operating track ───────────────────────────────────────────────────────────
  const setPopulation = useCallback<IcfrCtx['setPopulation']>((controlId, population) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, population } }));
  }, [patchControl, role]);

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

  // IPE check — the system report is only reliable once someone has validated it.
  const validateIpe = useCallback<IcfrCtx['validateIpe']>((controlId) => {
    if (role !== 'auditor') return;
    patchControl(controlId, c => c.operating.population ? ({ ...c, operating: { ...c.operating, population: { ...c.operating.population, ipeValidated: { by: me, at: 'just now' } } } }) : c);
    pushExec(() => ({ controlId, track: 'operating', kind: 'population', verb: 'validated the population (IPE) — completeness & accuracy' }));
  }, [patchControl, me, pushExec, role]);

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
      const added = sampleRefs(c.process, s.size + extra).slice(s.size).map((ref, i) => ({ id: `s${s.size + i}`, ref, result: 'Not tested' as TestResult }));
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
  const runStepValidation = useCallback<IcfrCtx['runStepValidation']>((controlId, stepId) => {
    if (role !== 'auditor') return;
    patchStep(controlId, stepId, (s, c) => {
      const willFail = (s.override ? s.override.result : s.result) === 'Fail';
      const res: TestResult = willFail ? 'Fail' : 'Pass';
      return stampSamples(c, { ...s, result: res, workflowRunRef: 'Ask IRA · validated · just now', validation: { result: res, qa: validationQA(s.description, willFail), summary: validationSummary(s.description, willFail, controlId + s.id), table: validationTable(willFail, controlId + s.id), fileName: s.inputFile?.name, at: 'just now' } }, res);
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
        validation: wantsValidation ? (s.validation ?? { result: res, qa: validationQA(s.description, fail), summary: validationSummary(s.description, fail, controlId + s.id), table: validationTable(fail, controlId + s.id), fileName: s.inputFile?.name, at: 'just now' }) : s.validation,
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
            validation: wantsValidation ? (s.validation ?? { result: res, qa: validationQA(s.description, fail), summary: validationSummary(s.description, fail, c.id + s.id), table: validationTable(fail, c.id + s.id), fileName: s.inputFile?.name, at: 'just now' }) : s.validation,
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
        const missing = c.design.documents.filter(d => d.status === 'Missing');
        if (missing.length) {
          newTasks.push({ id: `PBC-${prev.tasks.length + newTasks.length + 1}`, type: 'pbc', controlId: c.id, title: `Provide design documents (${missing.length})`, detail: `Needed for TOD: ${missing.map(d => d.kind).join(', ')}.`, assignee: c.owner, assigneeRole: 'risk-owner', raisedBy: me, dueLabel: 'Due in 3d', overdue: false, status: 'open' });
          newExecs.push({ id: uid('ex'), controlId: c.id, track: 'design', kind: 'request-docs', verb: `requested ${missing.length} design document${missing.length === 1 ? '' : 's'}`, by: me, role, at: 'just now' });
        }
        return { ...c, design: { ...c.design, documents: c.design.documents.map(d => d.status === 'Missing' ? { ...d, status: 'Requested' as DocStatus } : d) } };
      });
      return { ...prev, controls, tasks: [...prev.tasks, ...newTasks], executions: [...newExecs, ...prev.executions] };
    });
  }, [me, role]);

  // Evaluation is the auditor's lane — the owner never grades their own exception.
  const updateDeficiency = useCallback<IcfrCtx['updateDeficiency']>((id, patch) => {
    if (role !== 'auditor') return;
    setEng(prev => isEngagementLocked(prev) ? prev : ({ ...prev, deficiencies: prev.deficiencies.map(d => (d.id === id ? { ...d, ...patch } : d)) }));
  }, [role]);
  // The ground rules are the auditor's to set — everyone else reads them (at most).
  const updateRules = useCallback<IcfrCtx['updateRules']>((patch) => {
    if (role !== 'auditor') return;
    setEng(prev => isEngagementLocked(prev) ? prev : ({ ...prev, rules: { ...prev.rules, ...patch } }));
  }, [role]);
  const updateMateriality = useCallback<IcfrCtx['updateMateriality']>((patch) => {
    if (role !== 'auditor') return;
    setEng(prev => isEngagementLocked(prev) ? prev : ({ ...prev, ...patch }));
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
  // A passed retest never closes itself — it parks at 'Awaiting reviewer'. Only
  // the auditor records retest results; the owner never tests their own fix.
  // A failed retest sends the plan back to In progress.
  const recordRetest = useCallback<IcfrCtx['recordRetest']>((id, result) => {
    if (role !== 'auditor') return;
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      const target = prev.deficiencies.find(d => d.id === id);
      if (!target || target.status !== 'Retest') return prev;
      const event: ExecutionEvent = {
        id: uid('ex'), controlId: target.controlId, track: target.track, kind: 'exception',
        verb: `recorded retest ${result.toLowerCase()} on ${id}`, result, by: me, role, at: 'just now',
      };
      return {
        ...prev,
        deficiencies: prev.deficiencies.map(d => d.id === id ? { ...d, retest: { result, at: 'just now', by: me }, status: result === 'Pass' ? 'Awaiting reviewer' : 'Remediation', remediation: { ...d.remediation, status: result === 'Pass' ? 'Done' : 'In progress' } } : d),
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
      if (d.status !== 'Identified' && d.status !== 'Remediation') return d;
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

  const togglePeriod = useCallback(() => {
    if (role !== 'auditor') return;   // the testing period is the auditor's dial
    setEng(prev => isEngagementLocked(prev) ? prev : ({ ...prev, period: prev.period === 'Interim' ? 'Year-end' : 'Interim' }));
  }, [role]);

  const rollForward = useCallback(() => {
    setEng(prev => {
      if (isEngagementLocked(prev)) return prev;
      return {
        ...prev,
        period: 'Year-end',
        controls: prev.controls.map(c => {
          // design carries forward; operating re-tests unless automated + benchmarkable
          if (c.nature === 'Automated') return c;
          return { ...c, operating: { ...c.operating, conclusion: 'Not tested', override: undefined, testedBy: null, testedAt: null, steps: c.operating.steps.map(s => ({ ...s, result: 'Not tested', override: undefined, sampleResults: undefined })) } };
        }),
      };
    });
  }, []);

  // Preparer signs first, reviewer countersigns — names come from the engagement record.
  // Each signature stamps the ICFR conclusion as of that moment: open MW ⇒ not effective.
  // Same-person guard: one human never holds both signatures on the opinion.
  const signOffEngagement = useCallback<IcfrCtx['signOffEngagement']>((step) => {
    setEng(prev => (step === 'reviewer' && prev.reviewer === prev.preparer) ? prev : ({
      ...prev,
      signoff: {
        ...(step === 'preparer'
          ? { ...prev.signoff, preparer: { by: prev.preparer, at: 'just now' } }
          : { ...prev.signoff, reviewer: { by: prev.reviewer, at: 'just now' } }),
        icfrConclusion: icfrConclusion(prev),
      },
    }));
  }, []);

  const value = useMemo<IcfrCtx>(() => ({
    eng, role, tab, view, selectedControlId, racmEditor, me, meOwner, setMeOwner, racmProcess,
    setRole: changeRole, setTab, setView, openRacmMatrix, openRacmEditor, openControl, back, returnView,
    registerPreset, openRegister, clearRegisterPreset,
    setDocStatus, setDesignPoint, concludeDesign, overrideDesign,
    addDesignDoc, attachDesignEvidence, removeDesignDoc, addDesignPoint, removeDesignPoint, validateDesignPoint, overrideDesignPoint, requestDataByEmail,
    setPopulation, validateIpe, setMrc, setSampling, extendSample, resizeSample, setSampleResult, setStepResult, overrideStep, pullStepRun, attestStep, addStepEvidence, setStepInputFile, concludeOperating, overrideOperating,
    addAttribute, removeAttribute, mapStepWorkflow, setStepEvidenceMode, toggleStepAttest, toggleStepAI, runStepValidation, testAllAttributes,
    approveRacmRows, remarkRacmRow, clearRacmReview, bulkTestControls, racmDocs, addRacmDoc,
    addComment, resolveDiscussion,
    submitTask, clearTask, raiseQuery, requestDesignDocs,
    updateRules, applyRules, updateMateriality, updateDeficiency, updateAccount, setExceptionStatus, recordRetest, signOffException, reopenException, updateRemediation, addRemediationEvidence,
    addControl, signOffEngagement, reopenControl, signOffControlWp, returnControl,
    raiseReviewNote, resolveReviewNote, verifyReviewNote, reopenReviewNote,
    togglePeriod, rollForward,
  }), [eng, role, tab, view, selectedControlId, racmEditor, me, meOwner, racmProcess, changeRole, setTab, openRacmMatrix, openRacmEditor, openControl, back, returnView, registerPreset, openRegister, clearRegisterPreset, setDocStatus, setDesignPoint, concludeDesign, overrideDesign, addDesignDoc, attachDesignEvidence, removeDesignDoc, addDesignPoint, removeDesignPoint, validateDesignPoint, overrideDesignPoint, requestDataByEmail, setPopulation, validateIpe, setMrc, setSampling, extendSample, resizeSample, setSampleResult, setStepResult, overrideStep, pullStepRun, attestStep, addStepEvidence, setStepInputFile, concludeOperating, overrideOperating, addAttribute, removeAttribute, mapStepWorkflow, setStepEvidenceMode, toggleStepAttest, toggleStepAI, runStepValidation, testAllAttributes, approveRacmRows, remarkRacmRow, clearRacmReview, bulkTestControls, racmDocs, addRacmDoc, addComment, resolveDiscussion, submitTask, clearTask, raiseQuery, requestDesignDocs, updateRules, applyRules, updateMateriality, updateDeficiency, updateAccount, setExceptionStatus, recordRetest, signOffException, reopenException, updateRemediation, addRemediationEvidence, addControl, signOffEngagement, reopenControl, signOffControlWp, returnControl, raiseReviewNote, resolveReviewNote, verifyReviewNote, reopenReviewNote, togglePeriod, rollForward]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
