import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { seedControlTests } from './mockData';
import {
  type ActionTakenReport,
  type AttributeTest,
  type ControlTest,
  type EvidenceFile,
  type OwnerVerdict,
  type Phase,
  type PhaseRecord,
  type Role,
  type SelfAssessment,
  type Stage,
  type TestResult,
  type WorkflowRun,
} from './types';

type EvidenceTarget = 'self' | 'phase1' | 'phase2';

let atrSeq = 14;

function updateAttr(c: ControlTest, attrId: string, fn: (a: AttributeTest) => AttributeTest): ControlTest {
  return { ...c, attributes: c.attributes.map((a) => (a.id === attrId ? fn(a) : a)) };
}

/** Conclude from phase results: any recorded Fail ⇒ Ineffective. */
function deriveConclusion(c: ControlTest): 'Effective' | 'Ineffective' {
  const anyFail = c.attributes.some((a) => a.phase1.result === 'Fail' || a.phase2.result === 'Fail');
  return anyFail ? 'Ineffective' : 'Effective';
}

function makeAtr(c: ControlTest): ActionTakenReport {
  atrSeq += 1;
  const failing = c.attributes.find((a) => a.phase1.result === 'Fail' || a.phase2.result === 'Fail');
  return {
    id: `ATR-2026-${String(atrSeq).padStart(3, '0')}`,
    raisedAt: 'just now',
    severity: c.isKey ? 'High' : 'Medium',
    exception: failing?.phase2.notes || failing?.phase1.notes || `${c.name} did not operate effectively for the period.`,
    rootCause: '',
    managementAction: '',
    managementActionDate: null,
    remediationOwner: c.owner,
    status: 'Open',
    remediationResult: null,
    closedAt: null,
  };
}

export interface ControlTestingApi {
  controls: ControlTest[];
  loading: boolean;
  selfAssess: (controlId: string, attrId: string, outcome: SelfAssessment, remark: string) => void;
  submitSelfAssessment: (controlId: string) => void;
  ownerReview: (controlId: string, attrId: string, verdict: OwnerVerdict, remark: string) => void;
  submitOwnerReview: (controlId: string) => void;
  recordPhase: (controlId: string, attrId: string, phase: Phase, result: TestResult, notes: string) => void;
  advancePhase: (controlId: string) => void;
  conclude: (controlId: string) => 'Effective' | 'Ineffective';
  updateAtr: (controlId: string, patch: Partial<ActionTakenReport>) => void;
  remediate: (controlId: string, result: TestResult) => void;
  attachEvidence: (controlId: string, attrId: string, target: EvidenceTarget, file: EvidenceFile) => void;
  setWorkflowRun: (controlId: string, attrId: string, run: WorkflowRun) => void;
}

export function useControlTesting(): ControlTestingApi {
  const [controls, setControls] = useState<ControlTest[]>(() => seedControlTests());
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  // Simulate an initial fetch so the workspace can show skeletons on first paint.
  useEffect(() => {
    mounted.current = true;
    const t = setTimeout(() => mounted.current && setLoading(false), 650);
    return () => {
      mounted.current = false;
      clearTimeout(t);
    };
  }, []);

  const patch = useCallback((controlId: string, fn: (c: ControlTest) => ControlTest) => {
    setControls((prev) => prev.map((c) => (c.controlId === controlId ? fn(c) : c)));
  }, []);

  const selfAssess = useCallback<ControlTestingApi['selfAssess']>((controlId, attrId, outcome, remark) => {
    patch(controlId, (c) =>
      updateAttr(c, attrId, (a) => ({
        ...a,
        selfAssessment: { ...a.selfAssessment, outcome, remark, submittedBy: c.performer, submittedAt: 'just now' },
      })),
    );
  }, [patch]);

  const submitSelfAssessment = useCallback<ControlTestingApi['submitSelfAssessment']>((controlId) => {
    patch(controlId, (c) => ({ ...c, stage: 'awaiting-owner-review' as Stage, dueLabel: 'With owner', overdue: false }));
  }, [patch]);

  const ownerReview = useCallback<ControlTestingApi['ownerReview']>((controlId, attrId, verdict, remark) => {
    patch(controlId, (c) =>
      updateAttr(c, attrId, (a) => ({
        ...a,
        ownerReview: { ...a.ownerReview, verdict, remark, reviewedBy: c.owner, reviewedAt: 'just now' },
      })),
    );
  }, [patch]);

  const submitOwnerReview = useCallback<ControlTestingApi['submitOwnerReview']>((controlId) => {
    patch(controlId, (c) => ({ ...c, stage: 'awaiting-audit' as Stage, dueLabel: 'Ready for auditor' }));
  }, [patch]);

  const recordPhase = useCallback<ControlTestingApi['recordPhase']>((controlId, attrId, phase, result, notes) => {
    patch(controlId, (c) => {
      const next = updateAttr(c, attrId, (a) => {
        const rec: PhaseRecord = { ...(phase === 1 ? a.phase1 : a.phase2), result, notes, testedBy: 'You · Auditor', testedAt: 'just now' };
        return phase === 1 ? { ...a, phase1: rec } : { ...a, phase2: rec };
      });
      // Begin the audit on the first Phase 1 result.
      const stage: Stage = next.stage === 'awaiting-audit' && phase === 1 ? 'audit-phase-1' : next.stage;
      return { ...next, stage };
    });
  }, [patch]);

  const advancePhase = useCallback<ControlTestingApi['advancePhase']>((controlId) => {
    patch(controlId, (c) => (c.stage === 'audit-phase-1' ? { ...c, stage: 'audit-phase-2' as Stage } : c));
  }, [patch]);

  const conclude = useCallback<ControlTestingApi['conclude']>((controlId) => {
    const target = controls.find((c) => c.controlId === controlId);
    const verdict = target ? deriveConclusion(target) : 'Effective';
    patch(controlId, (c) => {
      const conclusion = deriveConclusion(c);
      return {
        ...c,
        stage: 'concluded' as Stage,
        conclusion,
        dueLabel: conclusion === 'Effective' ? 'Closed this cycle' : 'Remediation required',
        atr: conclusion === 'Ineffective' ? c.atr ?? makeAtr(c) : null,
      };
    });
    return verdict;
  }, [controls, patch]);

  const updateAtr = useCallback<ControlTestingApi['updateAtr']>((controlId, atrPatch) => {
    patch(controlId, (c) => (c.atr ? { ...c, atr: { ...c.atr, ...atrPatch } } : c));
  }, [patch]);

  const remediate = useCallback<ControlTestingApi['remediate']>((controlId, result) => {
    patch(controlId, (c) => {
      if (!c.atr) return c;
      const closed = result === 'Pass';
      return {
        ...c,
        dueLabel: closed ? 'Remediated · closed' : 'Remediation failed · reopened',
        atr: {
          ...c.atr,
          remediationResult: result,
          status: closed ? 'Closed' : 'In Remediation',
          closedAt: closed ? 'just now' : null,
        },
      };
    });
  }, [patch]);

  const attachEvidence = useCallback<ControlTestingApi['attachEvidence']>((controlId, attrId, target, file) => {
    patch(controlId, (c) =>
      updateAttr(c, attrId, (a) => {
        if (target === 'self') return { ...a, selfAssessment: { ...a.selfAssessment, evidence: [...a.selfAssessment.evidence, file] } };
        if (target === 'phase1') return { ...a, phase1: { ...a.phase1, evidence: [...a.phase1.evidence, file] } };
        return { ...a, phase2: { ...a.phase2, evidence: [...a.phase2.evidence, file] } };
      }),
    );
  }, [patch]);

  const setWorkflowRun = useCallback<ControlTestingApi['setWorkflowRun']>((controlId, attrId, run) => {
    patch(controlId, (c) => updateAttr(c, attrId, (a) => ({ ...a, workflow: run })));
  }, [patch]);

  return useMemo(
    () => ({
      controls,
      loading,
      selfAssess,
      submitSelfAssessment,
      ownerReview,
      submitOwnerReview,
      recordPhase,
      advancePhase,
      conclude,
      updateAtr,
      remediate,
      attachEvidence,
      setWorkflowRun,
    }),
    [controls, loading, selfAssess, submitSelfAssessment, ownerReview, submitOwnerReview, recordPhase, advancePhase, conclude, updateAtr, remediate, attachEvidence, setWorkflowRun],
  );
}

// ─── selectors / derivations for the UI ─────────────────────────────────────────

export interface RoleQueue {
  /** Controls this role can act on right now. */
  actionable: ControlTest[];
  /** Everything else, for context. */
  rest: ControlTest[];
}

const ROLE_ACTIONABLE: Record<Role, (c: ControlTest) => boolean> = {
  performer: (c) => c.stage === 'awaiting-self-assessment',
  owner: (c) => c.stage === 'awaiting-owner-review' || (c.stage === 'concluded' && c.atr?.status === 'In Remediation'),
  auditor: (c) => c.stage === 'awaiting-audit' || c.stage === 'audit-phase-1' || c.stage === 'audit-phase-2',
};

export function queueForRole(controls: ControlTest[], role: Role): RoleQueue {
  const pred = ROLE_ACTIONABLE[role];
  return {
    actionable: controls.filter(pred),
    rest: controls.filter((c) => !pred(c)),
  };
}

export interface RoleStats {
  actionable: number;
  inFlight: number;
  concluded: number;
  failed: number;
}

export function statsForRole(controls: ControlTest[], role: Role): RoleStats {
  const { actionable } = queueForRole(controls, role);
  return {
    actionable: actionable.length,
    inFlight: controls.filter((c) => c.stage !== 'concluded').length,
    concluded: controls.filter((c) => c.stage === 'concluded').length,
    failed: controls.filter((c) => c.conclusion === 'Ineffective').length,
  };
}
