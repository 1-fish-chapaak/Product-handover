import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { seedIcfrEngagement } from './mockData';
import { validationQA } from './helpers';
import type {
  Attestation, Control, Deficiency, DesignDoc, DesignDocKind, DesignPoint, DiscussionAnchor, DocStatus,
  EvidenceFile, EvidenceMode, HandoffTask, IcfrEngagement, OperatingStep, Override, Population, Role, Sampling, TestResult, TrackConclusion,
} from './types';

let _uid = 0;
const uid = (p: string) => `${p}-${(++_uid).toString(36)}`;
import { ROLE_LABEL } from './types';

type View = 'register' | 'dossier' | 'portal' | 'deficiencies' | 'scope' | 'setup';

interface IcfrCtx {
  eng: IcfrEngagement;
  role: Role;
  view: View;
  selectedControlId: string | null;
  me: string;
  setRole: (r: Role) => void;
  setView: (v: View) => void;
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
  attestStep: (controlId: string, stepId: string, note: string) => void;
  addStepEvidence: (controlId: string, stepId: string, fileName: string) => void;
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
  // discussions
  addComment: (controlId: string, anchor: DiscussionAnchor, text: string) => void;
  resolveDiscussion: (discussionId: string, resolved: boolean) => void;
  // handoffs
  submitTask: (taskId: string) => void;
  clearTask: (taskId: string) => void;
  raiseQuery: (controlId: string, title: string, detail: string) => void;
  requestDesignDocs: (controlIds: string[]) => void;
  // deficiencies + engagement
  updateDeficiency: (id: string, patch: Partial<Deficiency>) => void;
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

export function IcfrProvider({ children, initialRole = 'auditor' }: { children: ReactNode; initialRole?: Role }) {
  const [eng, setEng] = useState<IcfrEngagement>(() => seedIcfrEngagement());
  const [role, setRole] = useState<Role>(initialRole);
  const [view, setView] = useState<View>(initialRole === 'risk-owner' ? 'portal' : 'register');
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null);

  const me = `You · ${ROLE_LABEL[role]}`;

  const patchControl = useCallback((controlId: string, fn: (c: Control) => Control) => {
    setEng(prev => ({ ...prev, controls: prev.controls.map(c => (c.id === controlId ? fn(c) : c)) }));
  }, []);

  const changeRole = useCallback((r: Role) => {
    setRole(r);
    setView(r === 'risk-owner' ? 'portal' : 'register');
    setSelectedControlId(null);
  }, []);

  const openControl = useCallback((id: string) => { setSelectedControlId(id); setView('dossier'); }, []);
  const back = useCallback(() => { setView('register'); setSelectedControlId(null); }, []);

  // ── design track ──────────────────────────────────────────────────────────────
  const setDocStatus = useCallback<IcfrCtx['setDocStatus']>((controlId, docId, status) => {
    patchControl(controlId, c => ({ ...c, design: { ...c.design, documents: c.design.documents.map(d => d.id === docId ? { ...d, status, uploadedBy: status === 'Received' ? 'Risk Owner' : d.uploadedBy, at: status === 'Received' ? 'just now' : d.at } : d) } }));
  }, [patchControl]);

  const setDesignPoint = useCallback<IcfrCtx['setDesignPoint']>((controlId, pointId, result) => {
    patchControl(controlId, c => ({ ...c, design: { ...c.design, points: c.design.points.map(p => p.id === pointId ? { ...p, result } : p) } }));
  }, [patchControl]);

  const concludeDesign = useCallback<IcfrCtx['concludeDesign']>((controlId, conclusion) => {
    patchControl(controlId, c => ({ ...c, design: { ...c.design, conclusion, testedBy: me, testedAt: 'just now' } }));
  }, [patchControl, me]);

  const overrideDesign = useCallback<IcfrCtx['overrideDesign']>((controlId, override) => {
    patchControl(controlId, c => ({ ...c, design: { ...c.design, override: override ?? undefined } }));
  }, [patchControl]);

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
  }, [patchControl]);
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
  }, [me]);

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
  }, [patchStep]);

  const attestStep = useCallback<IcfrCtx['attestStep']>((controlId, stepId, note) => {
    patchStep(controlId, stepId, s => {
      const att: Attestation = { note, by: me, role, at: 'just now', evidence: s.attestation?.evidence ?? [] };
      return { ...s, attestation: att };
    });
  }, [patchStep, me, role]);

  const addStepEvidence = useCallback<IcfrCtx['addStepEvidence']>((controlId, stepId, fileName) => {
    patchStep(controlId, stepId, s => {
      const ev: EvidenceFile = { id: uid('f'), name: fileName, kind: fileName.endsWith('.xlsx') ? 'XLSX' : 'PDF', uploadedBy: me, uploadedAt: 'just now' };
      const att: Attestation = s.attestation ?? { note: '', by: me, role, at: 'just now', evidence: [] };
      return { ...s, attestEnabled: true, attestation: { ...att, evidence: [...att.evidence, ev] } };
    });
  }, [patchStep, me, role]);

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
      return { ...s, result: willFail ? 'Fail' : 'Pass', workflowRunRef: 'Ask IRA · validated · just now', validation: { qa: validationQA(s.description, willFail), at: 'just now' } };
    });
  }, [patchStep]);
  const testAllAttributes = useCallback<IcfrCtx['testAllAttributes']>((controlId) => {
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, steps: c.operating.steps.map(s => {
      const res: TestResult = s.result === 'Fail' || s.override?.result === 'Fail' ? 'Fail' : 'Pass';
      return { ...s, result: res, workflowRunRef: s.workflowName ? (s.workflowRunRef ?? 'run · just now · 0 exceptions') : s.workflowRunRef };
    }) } }));
  }, [patchControl]);

  const concludeOperating = useCallback<IcfrCtx['concludeOperating']>((controlId, conclusion) => {
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, conclusion, testedBy: me, testedAt: 'just now' } }));
  }, [patchControl, me]);

  const overrideOperating = useCallback<IcfrCtx['overrideOperating']>((controlId, override) => {
    patchControl(controlId, c => ({ ...c, operating: { ...c.operating, override: override ?? undefined } }));
  }, [patchControl]);

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
      const controls = prev.controls.map(c => {
        if (!ids.has(c.id)) return c;
        const missing = c.design.documents.filter(d => d.status === 'Missing');
        if (missing.length) newTasks.push({ id: `PBC-${prev.tasks.length + newTasks.length + 1}`, type: 'pbc', controlId: c.id, title: `Provide design documents (${missing.length})`, detail: `Needed for TOD: ${missing.map(d => d.kind).join(', ')}.`, assignee: c.owner, assigneeRole: 'risk-owner', raisedBy: me, dueLabel: 'Due in 3d', overdue: false, status: 'open' });
        return { ...c, design: { ...c.design, documents: c.design.documents.map(d => d.status === 'Missing' ? { ...d, status: 'Requested' as DocStatus } : d) } };
      });
      return { ...prev, controls, tasks: [...prev.tasks, ...newTasks] };
    });
  }, [me]);

  const updateDeficiency = useCallback<IcfrCtx['updateDeficiency']>((id, patch) => {
    setEng(prev => ({ ...prev, deficiencies: prev.deficiencies.map(d => (d.id === id ? { ...d, ...patch } : d)) }));
  }, []);

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
    setEng(newEng); setSelectedControlId(null); setView('register');
  }, []);

  const value = useMemo<IcfrCtx>(() => ({
    eng, role, view, selectedControlId, me,
    setRole: changeRole, setView, openControl, back,
    setDocStatus, setDesignPoint, concludeDesign, overrideDesign,
    addDesignDoc, removeDesignDoc, addDesignPoint, removeDesignPoint, validateDesignPoint, overrideDesignPoint, requestDataByEmail,
    setPopulation, setSampling, setStepResult, overrideStep, pullStepRun, attestStep, addStepEvidence, concludeOperating, overrideOperating,
    addAttribute, removeAttribute, mapStepWorkflow, setStepEvidenceMode, toggleStepAttest, toggleStepAI, runStepValidation, testAllAttributes,
    addComment, resolveDiscussion,
    submitTask, clearTask, raiseQuery, requestDesignDocs,
    updateDeficiency, togglePeriod, rollForward, createEngagement,
  }), [eng, role, view, selectedControlId, me, changeRole, openControl, back, setDocStatus, setDesignPoint, concludeDesign, overrideDesign, addDesignDoc, removeDesignDoc, addDesignPoint, removeDesignPoint, validateDesignPoint, overrideDesignPoint, requestDataByEmail, setPopulation, setSampling, setStepResult, overrideStep, pullStepRun, attestStep, addStepEvidence, concludeOperating, overrideOperating, addAttribute, removeAttribute, mapStepWorkflow, setStepEvidenceMode, toggleStepAttest, toggleStepAI, runStepValidation, testAllAttributes, addComment, resolveDiscussion, submitTask, clearTask, raiseQuery, requestDesignDocs, updateDeficiency, togglePeriod, rollForward, createEngagement]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
