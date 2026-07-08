import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { seedIcfrEngagement, type SeedMeta } from './mockData';
import { validationQA, validationSummary, validationTable } from './helpers';
import type {
  Attestation, Control, Deficiency, DesignDoc, DesignDocKind, DesignPoint, DiscussionAnchor, DocStatus,
  EvidenceFile, EvidenceMode, ExceptionStatus, ExecKind, ExecutionEvent, HandoffTask, IcfrEngagement,
  MaterialityRules, OperatingStep, Override, Population, RacmReview, Role, Sampling, TestResult, TrackConclusion,
} from './types';

let _uid = 0;
const uid = (p: string) => `${p}-${(++_uid).toString(36)}`;
/** What gets logged for one execution — actor/id/time are stamped by pushExec. */
type ExecDraft = { controlId: string; track: 'design' | 'operating'; kind: ExecKind; verb: string; target?: string; result?: TestResult | TrackConclusion };
const short = (s: string, n = 40) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
import { ROLE_LABEL } from './types';

// The four primary tabs — mirrors how other engagements are laid out.
export type SoxTab = 'overview' | 'racm' | 'risks' | 'controls';
// 'overview' | 'racm' | 'risks' | 'register'(=Control Library) are the tab roots; the rest are drill-ins.
type View = 'overview' | 'racm' | 'racm-editor' | 'risks' | 'register' | 'dossier' | 'deficiencies' | 'scope' | 'setup';
export interface RacmEditorMeta { name: string; process?: string }

const TAB_ROOT: Record<SoxTab, View> = { overview: 'overview', racm: 'racm', risks: 'risks', controls: 'register' };

interface IcfrCtx {
  eng: IcfrEngagement;
  role: Role;
  tab: SoxTab;
  view: View;
  selectedControlId: string | null;
  racmEditor: RacmEditorMeta | null;
  me: string;
  setRole: (r: Role) => void;
  setTab: (t: SoxTab) => void;
  setView: (v: View) => void;
  openRacmEditor: (meta: RacmEditorMeta) => void;
  openControl: (id: string) => void;
  back: () => void;
  // design track
  setDocStatus: (controlId: string, docId: string, status: DocStatus) => void;
  setDesignPoint: (controlId: string, pointId: string, result: TestResult) => void;
  concludeDesign: (controlId: string, conclusion: TrackConclusion) => void;
  overrideDesign: (controlId: string, override: Override | null) => void;
  // design CRUD + validation
  addDesignDoc: (controlId: string, kind: DesignDocKind) => void;
  removeDesignDoc: (controlId: string, docId: string) => void;
  addDesignPoint: (controlId: string, text: string) => void;
  removeDesignPoint: (controlId: string, pointId: string) => void;
  validateDesignPoint: (controlId: string, pointId: string) => void;
  overrideDesignPoint: (controlId: string, pointId: string, override: Override | null) => void;
  requestDataByEmail: (controlId: string, docIds: string[], emails: string[]) => void;
  // operating track
  setPopulation: (controlId: string, population: Population) => void;
  setSampling: (controlId: string, sampling: Sampling) => void;
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
  racmDocs: EvidenceFile[];
  addRacmDoc: (fileName: string) => void;
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
  updateMateriality: (patch: { materiality?: number; performanceMateriality?: number }) => void;
  // deficiencies / exception lifecycle
  updateDeficiency: (id: string, patch: Partial<Deficiency>) => void;
  setExceptionStatus: (id: string, status: ExceptionStatus) => void;
  recordRetest: (id: string, result: 'Pass' | 'Fail') => void;
  signOffException: (id: string) => void;
  togglePeriod: () => void;
  rollForward: () => void;
  createEngagement: (eng: IcfrEngagement) => void;
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
  const [racmDocs, setRacmDocs] = useState<EvidenceFile[]>([]);

  const me = `You · ${ROLE_LABEL[role]}`;

  const patchControl = useCallback((controlId: string, fn: (c: Control) => Control) => {
    setEng(prev => ({ ...prev, controls: prev.controls.map(c => (c.id === controlId ? fn(c) : c)) }));
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
  }, []);

  const changeRole = useCallback((r: Role) => {
    setRole(r);
    setTabState('overview');
    setView('overview');
    setSelectedControlId(null);
  }, []);

  // Open a RACM in the full Excel editor (the Process-Hub experience), kept under the RACM tab.
  const openRacmEditor = useCallback((meta: RacmEditorMeta) => { setRacmEditor(meta); setTabState('racm'); setView('racm-editor'); }, []);

  const openControl = useCallback((id: string) => { setSelectedControlId(id); setView('dossier'); }, []);
  // Drill-ins return to the active tab's root, so the tab bar stays in context.
  const back = useCallback(() => { setView(TAB_ROOT[tab]); setSelectedControlId(null); }, [tab]);

  // ── design track ──────────────────────────────────────────────────────────────
  const setDocStatus = useCallback<IcfrCtx['setDocStatus']>((controlId, docId, status) => {
    patchControl(controlId, c => ({ ...c, design: { ...c.design, documents: c.design.documents.map(d => d.id === docId ? { ...d, status, uploadedBy: status === 'Received' ? 'Risk Owner' : d.uploadedBy, at: status === 'Received' ? 'just now' : d.at } : d) } }));
    if (status === 'Received') pushExec(prev => { const d = prev.controls.find(c => c.id === controlId)?.design.documents.find(dd => dd.id === docId); return d ? { controlId, track: 'design', kind: 'receive-doc', verb: 'marked received', target: d.kind } : null; });
  }, [patchControl, pushExec]);

  const setDesignPoint = useCallback<IcfrCtx['setDesignPoint']>((controlId, pointId, result) => {
    patchControl(controlId, c => ({ ...c, design: { ...c.design, points: c.design.points.map(p => p.id === pointId ? { ...p, result } : p) } }));
  }, [patchControl]);

  const concludeDesign = useCallback<IcfrCtx['concludeDesign']>((controlId, conclusion) => {
    patchControl(controlId, c => ({ ...c, design: { ...c.design, conclusion, testedBy: me, testedAt: 'just now' } }));
    if (conclusion !== 'Not tested') pushExec(() => ({ controlId, track: 'design', kind: 'conclude', verb: `concluded design ${conclusion.toLowerCase()}`, result: conclusion }));
  }, [patchControl, me, pushExec]);

  const overrideDesign = useCallback<IcfrCtx['overrideDesign']>((controlId, override) => {
    patchControl(controlId, c => ({ ...c, design: { ...c.design, override: override ?? undefined } }));
    if (override) pushExec(() => ({ controlId, track: 'design', kind: 'override', verb: 'overrode the design conclusion', result: override.result === 'Effective' ? 'Effective' : 'Ineffective' }));
  }, [patchControl, pushExec]);

  const addDesignDoc = useCallback<IcfrCtx['addDesignDoc']>((controlId, kind) => {
    patchControl(controlId, c => ({ ...c, design: { ...c.design, documents: [...c.design.documents, { id: uid('dd'), kind, name: `${kind} — to provide`, status: 'Missing' } as DesignDoc] } }));
  }, [patchControl]);
  const removeDesignDoc = useCallback<IcfrCtx['removeDesignDoc']>((controlId, docId) => {
    patchControl(controlId, c => ({ ...c, design: { ...c.design, documents: c.design.documents.filter(d => d.id !== docId) } }));
  }, [patchControl]);
  const addDesignPoint = useCallback<IcfrCtx['addDesignPoint']>((controlId, text) => {
    patchControl(controlId, c => ({ ...c, design: { ...c.design, points: [...c.design.points, { id: uid('dp'), text, result: 'Not tested', workflowId: uid('wf-tod'), workflowName: 'Design walkthrough check' } as DesignPoint] } }));
  }, [patchControl]);
  const removeDesignPoint = useCallback<IcfrCtx['removeDesignPoint']>((controlId, pointId) => {
    patchControl(controlId, c => ({ ...c, design: { ...c.design, points: c.design.points.filter(p => p.id !== pointId) } }));
  }, [patchControl]);
  const validateDesignPoint = useCallback<IcfrCtx['validateDesignPoint']>((controlId, pointId) => {
    patchControl(controlId, c => ({ ...c, design: { ...c.design, points: c.design.points.map(p => {
      if (p.id !== pointId) return p;
      const willFail = (p.override ? p.override.result : p.result) === 'Fail';
      return { ...p, result: willFail ? 'Fail' : 'Pass', override: undefined, workflowRunRef: 'run · validated · just now', validation: { qa: validationQA(p.text, willFail), at: 'just now' } };
    }) } }));
    pushExec(prev => { const p = prev.controls.find(c => c.id === controlId)?.design.points.find(pt => pt.id === pointId); return p ? { controlId, track: 'design', kind: 'validate', verb: 'validated', target: short(p.text), result: p.result } : null; });
  }, [patchControl, pushExec]);
  const overrideDesignPoint = useCallback<IcfrCtx['overrideDesignPoint']>((controlId, pointId, override) => {
    patchControl(controlId, c => ({ ...c, design: { ...c.design, points: c.design.points.map(p => p.id === pointId ? { ...p, override: override ?? undefined } : p) } }));
  }, [patchControl]);
  const requestDataByEmail = useCallback<IcfrCtx['requestDataByEmail']>((controlId, docIds, emails) => {
    setEng(prev => {
      const ctrl = prev.controls.find(c => c.id === controlId);
      const kinds = ctrl ? ctrl.design.documents.filter(d => docIds.includes(d.id)).map(d => d.kind) : [];
      const task: HandoffTask = { id: uid('PBC'), type: 'pbc', controlId, title: `Provide design documents (${docIds.length})`, detail: `Requested from ${emails.join(', ')} — ${kinds.join(', ')}.`, assignee: emails[0] ?? 'Risk Owner', assigneeRole: 'risk-owner', raisedBy: me, dueLabel: 'Due in 3d', overdue: false, status: 'open' };
      return { ...prev, controls: prev.controls.map(c => c.id === controlId ? { ...c, design: { ...c.design, documents: c.design.documents.map(d => docIds.includes(d.id) ? { ...d, status: 'Requested' as DocStatus } : d) } } : c), tasks: [...prev.tasks, task] };
    });
    pushExec(() => ({ controlId, track: 'design', kind: 'request-docs', verb: `requested ${docIds.length} design document${docIds.length === 1 ? '' : 's'}` }));
  }, [me, pushExec]);

  // ── operating track ───────────────────────────────────────────────────────────
  const setPopulation = useCallback<IcfrCtx['setPopulation']>((controlId, population) => {
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, population } }));
  }, [patchControl]);

  const setSampling = useCallback<IcfrCtx['setSampling']>((controlId, sampling) => {
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, sampling } }));
  }, [patchControl]);

  const setStepResult = useCallback<IcfrCtx['setStepResult']>((controlId, stepId, result) => {
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, steps: c.operating.steps.map(s => s.id === stepId ? { ...s, result } : s) } }));
  }, [patchControl]);

  const overrideStep = useCallback<IcfrCtx['overrideStep']>((controlId, stepId, override) => {
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, steps: c.operating.steps.map(s => s.id === stepId ? { ...s, override: override ?? undefined } : s) } }));
  }, [patchControl]);

  const patchStep = useCallback((controlId: string, stepId: string, fn: (s: Control['operating']['steps'][number]) => Control['operating']['steps'][number]) => {
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, steps: c.operating.steps.map(s => s.id === stepId ? fn(s) : s) } }));
  }, [patchControl]);

  const pullStepRun = useCallback<IcfrCtx['pullStepRun']>((controlId, stepId) => {
    patchStep(controlId, stepId, s => ({ ...s, workflowRunRef: 'run · just now · 0 exceptions', result: s.result === 'Not tested' ? 'Pass' : s.result }));
    pushExec(prev => { const s = prev.controls.find(c => c.id === controlId)?.operating.steps.find(st => st.id === stepId); return s ? { controlId, track: 'operating', kind: 'pull-run', verb: 'pulled a workflow run', target: s.code, result: s.result } : null; });
  }, [patchStep, pushExec]);

  const attestStep = useCallback<IcfrCtx['attestStep']>((controlId, stepId, note, result) => {
    patchStep(controlId, stepId, s => {
      const att: Attestation = { result, note, by: me, role, at: 'just now', evidence: s.attestation?.evidence ?? [] };
      return { ...s, attestEnabled: true, attestation: att, result };   // a manual attestation IS the attribute's result
    });
    pushExec(prev => { const s = prev.controls.find(c => c.id === controlId)?.operating.steps.find(st => st.id === stepId); return s ? { controlId, track: 'operating', kind: 'attest', verb: `attested ${result.toLowerCase()}`, target: s.code, result } : null; });
  }, [patchStep, me, role, pushExec]);

  const addStepEvidence = useCallback<IcfrCtx['addStepEvidence']>((controlId, stepId, fileName) => {
    patchStep(controlId, stepId, s => {
      const ev: EvidenceFile = { id: uid('f'), name: fileName, kind: fileName.endsWith('.xlsx') ? 'XLSX' : 'PDF', uploadedBy: me, uploadedAt: 'just now' };
      const att: Attestation = s.attestation ?? { note: '', by: me, role, at: 'just now', evidence: [] };
      return { ...s, attestEnabled: true, attestation: { ...att, evidence: [...att.evidence, ev] } };
    });
  }, [patchStep, me, role]);

  const setStepInputFile = useCallback<IcfrCtx['setStepInputFile']>((controlId, stepId, fileName) => {
    patchStep(controlId, stepId, s => ({ ...s, inputFile: { id: uid('f'), name: fileName, kind: fileName.endsWith('.xlsx') ? 'XLSX' : fileName.endsWith('.csv') ? 'CSV' : 'PDF', uploadedBy: me, uploadedAt: 'just now' } }));
  }, [patchStep, me]);

  const addAttribute = useCallback<IcfrCtx['addAttribute']>((controlId, description) => {
    patchControl(controlId, c => {
      const step: OperatingStep = { id: uid('os'), code: `${c.wpRef}.${c.operating.steps.length + 1}`, description, assertion: 'Accuracy', precision: 'Per item', procedures: ['Inspection'], result: 'Not tested' };
      return { ...c, operating: { ...c.operating, steps: [...c.operating.steps, step] } };
    });
  }, [patchControl]);
  const removeAttribute = useCallback<IcfrCtx['removeAttribute']>((controlId, stepId) => {
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, steps: c.operating.steps.filter(s => s.id !== stepId) } }));
  }, [patchControl]);
  const mapStepWorkflow = useCallback<IcfrCtx['mapStepWorkflow']>((controlId, stepId, name) => {
    patchStep(controlId, stepId, s => ({ ...s, evidenceMode: 'workflow', workflowId: uid('wf'), workflowName: name, workflowRunRef: undefined }));
  }, [patchStep]);
  const setStepEvidenceMode = useCallback<IcfrCtx['setStepEvidenceMode']>((controlId, stepId, mode) => {
    patchStep(controlId, stepId, s => ({ ...s, evidenceMode: mode }));
  }, [patchStep]);
  const toggleStepAttest = useCallback<IcfrCtx['toggleStepAttest']>((controlId, stepId, enabled) => {
    patchStep(controlId, stepId, s => ({ ...s, attestEnabled: enabled }));
  }, [patchStep]);
  const toggleStepAI = useCallback<IcfrCtx['toggleStepAI']>((controlId, stepId, on) => {
    patchStep(controlId, stepId, s => ({ ...s, aiValidation: on }));
  }, [patchStep]);
  const runStepValidation = useCallback<IcfrCtx['runStepValidation']>((controlId, stepId) => {
    patchStep(controlId, stepId, s => {
      const willFail = (s.override ? s.override.result : s.result) === 'Fail';
      const res: TestResult = willFail ? 'Fail' : 'Pass';
      return { ...s, result: res, workflowRunRef: 'Ask IRA · validated · just now', validation: { result: res, qa: validationQA(s.description, willFail), summary: validationSummary(s.description, willFail), table: validationTable(willFail), fileName: s.inputFile?.name, at: 'just now' } };
    });
    pushExec(prev => { const s = prev.controls.find(c => c.id === controlId)?.operating.steps.find(st => st.id === stepId); return s ? { controlId, track: 'operating', kind: 'validate', verb: 'validated against file', target: s.code, result: s.result } : null; });
  }, [patchStep, pushExec]);
  const testAllAttributes = useCallback<IcfrCtx['testAllAttributes']>((controlId) => {
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, steps: c.operating.steps.map(s => {
      const res: TestResult = s.result === 'Fail' || s.override?.result === 'Fail' ? 'Fail' : 'Pass';
      return { ...s, result: res, workflowRunRef: s.workflowName ? (s.workflowRunRef ?? 'run · just now · 0 exceptions') : s.workflowRunRef };
    }) } }));
    pushExec(prev => { const steps = prev.controls.find(cc => cc.id === controlId)?.operating.steps; return steps && steps.length ? { controlId, track: 'operating', kind: 'test-all', verb: 'tested all attributes', target: `${steps.length} attribute${steps.length === 1 ? '' : 's'}`, result: steps.some(s => s.result === 'Fail') ? 'Fail' : 'Pass' } : null; });
  }, [patchControl, pushExec]);

  const concludeOperating = useCallback<IcfrCtx['concludeOperating']>((controlId, conclusion) => {
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, conclusion, testedBy: me, testedAt: 'just now' } }));
    if (conclusion !== 'Not tested') pushExec(() => ({ controlId, track: 'operating', kind: 'conclude', verb: `concluded operating ${conclusion.toLowerCase()}`, result: conclusion }));
  }, [patchControl, me, pushExec]);

  const overrideOperating = useCallback<IcfrCtx['overrideOperating']>((controlId, override) => {
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, override: override ?? undefined } }));
    if (override) pushExec(() => ({ controlId, track: 'operating', kind: 'override', verb: 'overrode the operating conclusion', result: override.result === 'Effective' ? 'Effective' : 'Ineffective' }));
  }, [patchControl, pushExec]);

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
    setEng(prev => {
      const ids = new Set(controlIds);
      const execs: ExecutionEvent[] = [];
      const controls = prev.controls.map(c => {
        if (!ids.has(c.id)) return c;
        const points = c.design.points.map(p => {
          const willFail = (p.override ? p.override.result : p.result) === 'Fail';
          return { ...p, result: (willFail ? 'Fail' : 'Pass') as TestResult, override: undefined, workflowRunRef: 'run · validated · just now', validation: { qa: validationQA(p.text, willFail), at: 'just now' } };
        });
        const steps = c.operating.steps.map(s => {
          const res: TestResult = s.result === 'Fail' || s.override?.result === 'Fail' ? 'Fail' : 'Pass';
          return { ...s, result: res, workflowRunRef: s.workflowName ? (s.workflowRunRef ?? 'run · just now · 0 exceptions') : s.workflowRunRef };
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
      return { ...prev, controls, executions: [...execs, ...prev.executions] };
    });
  }, [me, role]);

  const addRacmDoc = useCallback<IcfrCtx['addRacmDoc']>((fileName) => {
    const lower = fileName.toLowerCase();
    const kind: EvidenceFile['kind'] = lower.endsWith('.csv') ? 'CSV' : lower.endsWith('.xlsx') || lower.endsWith('.xls') ? 'XLSX' : lower.endsWith('.png') || lower.endsWith('.jpg') ? 'IMG' : 'PDF';
    setRacmDocs(prev => [{ id: uid('rd'), name: fileName, kind, uploadedBy: me, uploadedAt: 'just now' }, ...prev]);
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

  const updateDeficiency = useCallback<IcfrCtx['updateDeficiency']>((id, patch) => {
    setEng(prev => ({ ...prev, deficiencies: prev.deficiencies.map(d => (d.id === id ? { ...d, ...patch } : d)) }));
  }, []);
  const updateRules = useCallback<IcfrCtx['updateRules']>((patch) => {
    setEng(prev => ({ ...prev, rules: { ...prev.rules, ...patch } }));
  }, []);
  const updateMateriality = useCallback<IcfrCtx['updateMateriality']>((patch) => {
    setEng(prev => ({ ...prev, ...patch }));
  }, []);
  const setExceptionStatus = useCallback<IcfrCtx['setExceptionStatus']>((id, status) => {
    setEng(prev => ({ ...prev, deficiencies: prev.deficiencies.map(d => d.id === id ? { ...d, status } : d) }));
  }, []);
  const recordRetest = useCallback<IcfrCtx['recordRetest']>((id, result) => {
    setEng(prev => ({ ...prev, deficiencies: prev.deficiencies.map(d => d.id === id ? { ...d, retest: { result, at: 'just now', by: me }, status: result === 'Pass' ? 'Closed' : 'Remediation', remediation: { ...d.remediation, status: result === 'Pass' ? 'Done' : d.remediation.status } } : d) }));
  }, [me]);
  const signOffException = useCallback<IcfrCtx['signOffException']>((id) => {
    setEng(prev => ({ ...prev, deficiencies: prev.deficiencies.map(d => d.id === id ? { ...d, signoff: { by: me, at: 'just now' }, status: 'Closed' } : d) }));
  }, [me]);

  const togglePeriod = useCallback(() => {
    setEng(prev => ({ ...prev, period: prev.period === 'Interim' ? 'Year-end' : 'Interim' }));
  }, []);

  const rollForward = useCallback(() => {
    setEng(prev => ({
      ...prev,
      period: 'Year-end',
      controls: prev.controls.map(c => {
        // design carries forward; operating re-tests unless automated + benchmarkable
        if (c.nature === 'Automated') return c;
        return { ...c, operating: { ...c.operating, conclusion: 'Not tested', override: undefined, testedBy: null, testedAt: null, steps: c.operating.steps.map(s => ({ ...s, result: 'Not tested', override: undefined })) } };
      }),
    }));
  }, []);

  const createEngagement = useCallback<IcfrCtx['createEngagement']>((newEng) => {
    setEng(newEng); setSelectedControlId(null); setTabState('controls'); setView('register');
  }, []);

  const value = useMemo<IcfrCtx>(() => ({
    eng, role, tab, view, selectedControlId, racmEditor, me,
    setRole: changeRole, setTab, setView, openRacmEditor, openControl, back,
    setDocStatus, setDesignPoint, concludeDesign, overrideDesign,
    addDesignDoc, removeDesignDoc, addDesignPoint, removeDesignPoint, validateDesignPoint, overrideDesignPoint, requestDataByEmail,
    setPopulation, setSampling, setStepResult, overrideStep, pullStepRun, attestStep, addStepEvidence, setStepInputFile, concludeOperating, overrideOperating,
    addAttribute, removeAttribute, mapStepWorkflow, setStepEvidenceMode, toggleStepAttest, toggleStepAI, runStepValidation, testAllAttributes,
    approveRacmRows, remarkRacmRow, clearRacmReview, bulkTestControls, racmDocs, addRacmDoc,
    addComment, resolveDiscussion,
    submitTask, clearTask, raiseQuery, requestDesignDocs,
    updateRules, updateMateriality, updateDeficiency, setExceptionStatus, recordRetest, signOffException,
    togglePeriod, rollForward, createEngagement,
  }), [eng, role, tab, view, selectedControlId, racmEditor, me, changeRole, setTab, openRacmEditor, openControl, back, setDocStatus, setDesignPoint, concludeDesign, overrideDesign, addDesignDoc, removeDesignDoc, addDesignPoint, removeDesignPoint, validateDesignPoint, overrideDesignPoint, requestDataByEmail, setPopulation, setSampling, setStepResult, overrideStep, pullStepRun, attestStep, addStepEvidence, setStepInputFile, concludeOperating, overrideOperating, addAttribute, removeAttribute, mapStepWorkflow, setStepEvidenceMode, toggleStepAttest, toggleStepAI, runStepValidation, testAllAttributes, approveRacmRows, remarkRacmRow, clearRacmReview, bulkTestControls, racmDocs, addRacmDoc, addComment, resolveDiscussion, submitTask, clearTask, raiseQuery, requestDesignDocs, updateRules, updateMateriality, updateDeficiency, setExceptionStatus, recordRetest, signOffException, togglePeriod, rollForward, createEngagement]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
