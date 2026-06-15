import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { seedIcfrEngagement } from './mockData';
import { controlConclusion } from './helpers';
import type { Attribute, Control, HandoffTask, IcfrEngagement, Role, Stage, TestResult } from './types';

type View = 'command' | 'control' | 'portal' | 'deficiencies' | 'scope';

interface IcfrCtx {
  eng: IcfrEngagement;
  role: Role;
  view: View;
  selectedControlId: string | null;
  setRole: (r: Role) => void;
  setView: (v: View) => void;
  openControl: (id: string) => void;
  back: () => void;
  // mutations
  recordTod: (controlId: string, attrId: string, result: TestResult, note: string) => void;
  recordToe: (controlId: string, attrId: string, result: TestResult, note?: string) => void;
  setStage: (controlId: string, stage: Stage) => void;
  submitTask: (taskId: string) => void;
  clearTask: (taskId: string) => void;
}

const Ctx = createContext<IcfrCtx | null>(null);

export function useIcfr(): IcfrCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useIcfr must be used within IcfrProvider');
  return c;
}

function withAttr(c: Control, attrId: string, fn: (a: Attribute) => Attribute): Control {
  const attributes = c.attributes.map(a => (a.id === attrId ? fn(a) : a));
  return { ...c, attributes, conclusion: controlConclusion({ ...c, attributes }) };
}

export function IcfrProvider({ children, initialRole = 'auditor' }: { children: ReactNode; initialRole?: Role }) {
  const [eng, setEng] = useState<IcfrEngagement>(() => seedIcfrEngagement());
  const [role, setRole] = useState<Role>(initialRole);
  const [view, setView] = useState<View>(initialRole === 'risk-owner' ? 'portal' : 'command');
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null);

  const patchControl = useCallback((controlId: string, fn: (c: Control) => Control) => {
    setEng(prev => ({ ...prev, controls: prev.controls.map(c => (c.id === controlId ? fn(c) : c)) }));
  }, []);

  const changeRole = useCallback((r: Role) => {
    setRole(r);
    setView(r === 'risk-owner' ? 'portal' : 'command');
    setSelectedControlId(null);
  }, []);

  const openControl = useCallback((id: string) => { setSelectedControlId(id); setView('control'); }, []);
  const back = useCallback(() => { setView('command'); setSelectedControlId(null); }, []);

  const recordTod = useCallback<IcfrCtx['recordTod']>((controlId, attrId, result, note) => {
    patchControl(controlId, c => {
      const next = withAttr(c, attrId, a => ({ ...a, tod: { ...a.tod, result, note, testedBy: 'You · Auditor', testedAt: 'just now' } }));
      const stage: Stage = next.stage === 'evidence-received' || next.stage === 'not-started' ? 'tod' : next.stage;
      return { ...next, stage };
    });
  }, [patchControl]);

  const recordToe = useCallback<IcfrCtx['recordToe']>((controlId, attrId, result, note = '') => {
    patchControl(controlId, c => {
      const next = withAttr(c, attrId, a => ({ ...a, toe: { ...a.toe, result, note: note || a.toe.note, testedBy: 'You · Auditor', testedAt: 'just now' } }));
      const stage: Stage = next.conclusion === 'Effective' || next.conclusion === 'Ineffective' ? 'concluded' : 'toe';
      return { ...next, stage };
    });
  }, [patchControl]);

  const setStage = useCallback<IcfrCtx['setStage']>((controlId, stage) => {
    patchControl(controlId, c => ({ ...c, stage }));
  }, [patchControl]);

  const patchTask = useCallback((taskId: string, fn: (t: HandoffTask) => HandoffTask) => {
    setEng(prev => ({ ...prev, tasks: prev.tasks.map(t => (t.id === taskId ? fn(t) : t)) }));
  }, []);

  const submitTask = useCallback<IcfrCtx['submitTask']>((taskId) => {
    patchTask(taskId, t => ({ ...t, status: 'submitted', thread: [...t.thread, { by: t.assignee, at: 'just now', text: 'Submitted.' }] }));
    // a submitted PBC moves the control to evidence-received
    setEng(prev => {
      const task = prev.tasks.find(t => t.id === taskId);
      if (!task || task.type !== 'pbc') return prev;
      return { ...prev, controls: prev.controls.map(c => (c.id === task.controlId && c.stage === 'pbc-requested' ? { ...c, stage: 'evidence-received' } : c)) };
    });
  }, [patchTask]);

  const clearTask = useCallback<IcfrCtx['clearTask']>((taskId) => {
    patchTask(taskId, t => ({ ...t, status: 'cleared' }));
  }, [patchTask]);

  const value = useMemo<IcfrCtx>(() => ({
    eng, role, view, selectedControlId,
    setRole: changeRole, setView, openControl, back,
    recordTod, recordToe, setStage, submitTask, clearTask,
  }), [eng, role, view, selectedControlId, changeRole, openControl, back, recordTod, recordToe, setStage, submitTask, clearTask]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
