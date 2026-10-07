import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  X, Check, ChevronDown, Plus, Paperclip, ShieldCheck, History, Trash2, Link2, Search,
} from 'lucide-react';
import { PEOPLE } from '../../data/grc-domain';
import DatePicker from '../shared/DatePicker';
import type { AtrObservation, AtrActionPlan, AtrClassification } from './atrTypes';
import type { AtrEvent, AtrTimeline } from './atrTimeline';
import { fmtEventTime, ROLE_TONE } from './atrTimeline';
import {
  closeoutState, newCloseoutEvent, planApproved, planRejected, planActed, planSettled,
  resolveMatrixId, PHASE_TEXT, type CloseoutRole,
} from './atrCloseout';
import { useEscalationMatrices, escalationMatrices, policyFor, chainLine, approvalChain } from '../../data/escalationMatrixStore';
import { matrixForSeverity, summarizeMatrix } from './atr-upload/escalationMatrix';

// ─── Close out an observation, from the report ───
// Two columns of work in one panel: what the Auditor does, and what the Risk
// Owner does. The toggle decides which you are looking at; a dot marks the side
// the ball is currently in. Every action lands on the report's timeline, so the
// audit trail at the foot of the panel and the Report Snapshot are one record.

const SUBCLASSES: AtrClassification[] = ['System Deficiency', 'Design Deficiency', 'Procedural Non-Compliance', 'Other'];

/** A due date is a promise about the future, so the calendar starts at today and
 *  every earlier day is unselectable. */
/** Display stamps ("30 Jun 2026") and ISO both land as ISO, so an attached
 *  plan's date can go straight into the calendar. Unparseable input returns ''
 *  and the picker simply asks for a fresh date. */
function toIsoDate(v: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** An action plan that already exists somewhere in this report, offered for
 *  reuse so a fix written once can cover more than one observation. */
export interface ExistingPlan {
  /** The observation it was written under. */
  from: string;
  plan: AtrActionPlan;
}

// The auditor's two sign-offs — on the plan, and later on the action taken —
// work the same way: pick an outcome, then submit it. Nothing fires on the
// first click, so a decision is never one stray tap away from the record.
const GOOD_ON = 'border-compliant-600 bg-compliant-50 text-compliant-700';
const BAD_ON = 'border-risk-500 bg-risk-50 text-risk-700';

/** The auditor's verdict on the plan itself, before the work starts. */
type PlanOutcome = 'Approved' | 'Rejected';
const PLAN_OUTCOMES: { value: PlanOutcome; label: string; on: string }[] = [
  { value: 'Approved', label: 'Approve', on: GOOD_ON },
  { value: 'Rejected', label: 'Reject', on: BAD_ON },
];

/** The auditor's verdict on the action taken. */
type ActionOutcome = 'Implemented' | 'Partially Implemented' | 'Rejected';
const OUTCOMES: { value: ActionOutcome; label: string; on: string }[] = [
  { value: 'Implemented', label: 'Implemented', on: GOOD_ON },
  { value: 'Partially Implemented', label: 'Partially Implemented', on: 'border-mitigated-500 bg-mitigated-50 text-mitigated-700' },
  { value: 'Rejected', label: 'Reject', on: BAD_ON },
];

const FIELD = 'w-full h-9 px-2.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.8125rem] text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10';
const AREA = 'w-full px-2.5 py-2 rounded-md border border-canvas-border bg-canvas-elevated text-[0.8125rem] text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 resize-y placeholder:text-ink-400';
const LABEL = 'block text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-500 mb-1';
const BTN_PRIMARY = 'inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-brand-600 text-white text-[0.75rem] font-semibold hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors';
const BTN_GOOD = 'inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-compliant-600 text-white text-[0.75rem] font-semibold hover:bg-compliant-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors';
const BTN_QUIET = 'inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-canvas-border text-ink-700 text-[0.75rem] font-semibold hover:bg-canvas disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors';

const CHOICE = 'inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[0.75rem] font-semibold cursor-pointer transition-colors';
const CHOICE_OFF = 'border-canvas-border text-ink-700 hover:bg-canvas';

const pill = (text: string, tone: string) => <span className={`inline-flex items-center h-5 px-1.5 rounded-full text-[0.625rem] font-semibold whitespace-nowrap ${tone}`}>{text}</span>;
const TONE_DONE = 'bg-compliant-50 text-compliant-700';
const TONE_WAIT = 'bg-mitigated-50 text-mitigated-700';
const TONE_IDLE = 'bg-canvas text-ink-500 border border-canvas-border';

/** A collapsible section. Open by default when it is the thing to do now. */
function Card({ title, note, state, defaultOpen, children }: {
  title: string;
  note?: string;
  state?: { text: string; tone: string };
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  // When this card becomes the thing to do — because the other side just acted
  // — it opens itself. Collapsing it again is the reader's call.
  const [wasActive, setWasActive] = useState(!!defaultOpen);
  if (!!defaultOpen !== wasActive) {
    setWasActive(!!defaultOpen);
    if (defaultOpen) setOpen(true);
  }
  return (
    <section className="rounded-lg border border-canvas-border overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 bg-canvas/50 hover:bg-canvas cursor-pointer text-left">
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-[0.75rem] font-semibold text-ink-700">{title}</span>
          {state && pill(state.text, state.tone)}
        </span>
        <ChevronDown size={15} className={`text-ink-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="px-3.5 py-3 border-t border-canvas-border">
          {note && <p className="text-[0.71875rem] text-ink-500 leading-snug mb-3">{note}</p>}
          {children}
        </div>
      )}
    </section>
  );
}

/** A big either/or tile, the way the classification choice reads best. */
function ChoiceTile({ on, title, sub, onClick }: { on: boolean; title: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={`flex-1 min-w-0 text-left rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${on ? 'border-brand-400 bg-brand-50/60 ring-1 ring-brand-300' : 'border-canvas-border hover:border-brand-200'}`}>
      <span className={`block text-[0.8125rem] font-bold ${on ? 'text-brand-800' : 'text-ink-900'}`}>{title}</span>
      <span className="block text-[0.71875rem] text-ink-500 leading-snug mt-0.5">{sub}</span>
    </button>
  );
}

export default function AtrObservationCloseout({ open, index, obs, me, timeline, existingPlans = [], onApply, onClose }: {
  open: boolean;
  index: number;
  obs: AtrObservation | null;
  /** The signed-in user, recorded as the actor on every event. */
  me: string;
  /** The report's timeline — the audit trail at the foot of the panel. */
  timeline: AtrTimeline;
  /** Plans written under the report's other observations, for "Attach existing". */
  existingPlans?: ExistingPlan[];
  onApply: (events: AtrEvent[]) => void;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const [view, setView] = useState<CloseoutRole>('auditor');
  const [draftFor, setDraftFor] = useState<number | null>(null);

  // Drafts
  const [owner, setOwner] = useState('');
  const [verdict, setVerdict] = useState<'True Exception' | 'False Positive' | ''>('');
  const [sub, setSub] = useState<AtrClassification | ''>('');
  const [clsNote, setClsNote] = useState('');
  const [fpReason, setFpReason] = useState('');
  const [newPlans, setNewPlans] = useState<{ title: string; text: string; due: string }[]>([]);
  const [taken, setTaken] = useState<Record<number, { what: string; evidence: string }>>({});
  const [comment, setComment] = useState<Record<string, string>>({});
  const [fpDecision, setFpDecision] = useState<PlanOutcome | undefined>(undefined);
  const [planDecision, setPlanDecision] = useState<Record<number, PlanOutcome | undefined>>({});
  const [decision, setDecision] = useState<Record<number, ActionOutcome | undefined>>({});
  const [revise, setRevise] = useState<Record<number, { title: string; text: string; due: string } | undefined>>({});
  // The "Attach existing" picker, and what the reader has typed into it.
  const [picking, setPicking] = useState(false);
  const [pickQuery, setPickQuery] = useState('');
  // Configured in Administration → Approval & Escalation Matrix; the auditor
  // only picks a matrix, and the approval chain picks itself from the owner.
  const matrices = useEscalationMatrices();

  if (obs && draftFor !== index) {
    setDraftFor(index);
    const c0 = obs.closeout;
    setOwner(c0?.owner ?? '');
    setVerdict(c0?.verdict ?? '');
    setSub(c0?.classification ?? '');
    setClsNote(c0?.classificationComment ?? '');
    setFpReason(c0?.falsePositiveReason ?? '');
    setNewPlans([]);
    setTaken({});
    setComment({});
    setFpDecision(undefined);
    setPlanDecision({});
    setDecision({});
    setRevise({});
    setPicking(false);
    setPickQuery('');
    setView('auditor');
  }

  if (typeof document === 'undefined' || !obs) return null;
  const st = closeoutState(obs);
  const { plans, planIdx, co, closed, falsePositive, phase, actor } = st;
  // `plans` is this journey's work; `planIdx` says where each one sits in the
  // observation, so an event patches the plan the panel is actually showing.
  const realIdx = (i: number) => planIdx[i] ?? i;
  // A rejected false positive is back with the risk owner: the classification
  // reopens so they can make a different call.
  const fpSentBack = co.verdict === 'False Positive' && co.fpReview === 'Rejected';
  // The approval chain that covers the assigned risk owner. It attaches itself
  // from the policy — nobody picks a flow per observation.
  // One tie-up governs both halves: the matrix the auditor picked for this
  // observation says who approves as well as who gets chased.
  const policy = policyFor(co.escalationMatrixId);
  // Both sides end to end — the risk owner's own chain, then the audit side's.
  const levels = approvalChain(policy);
  /** One line for a gate: who decides now, and how far through the chain. */
  const gateLine = (level = 0) => {
    if (levels.length === 0) return null;
    const i = Math.min(Math.max(level, 0), levels.length - 1);
    const l = levels[i];
    const who = l.approvers.join(', ') || 'the audit team';
    return levels.length > 1
      ? `${who} · ${l.sideLabel} · ${l.name} (${i + 1} of ${levels.length})`
      : `${who} · ${l.name}`;
  };
  /** True when approving at this level finishes the chain. */
  const lastLevel = (level = 0) => levels.length === 0 || level >= levels.length - 1;
  const title = obs.title || `Observation ${index + 1}`;
  const obsRef = `OBS-${String(index + 1).padStart(2, '0')}`;
  // Only what was done here: the report arrives with its own generated history,
  // which belongs to the document and the Report Snapshot, not to this journey.
  const trail = [...timeline.events].filter(e => e.closeout && e.observationIndex === index).sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts));
  const c = (k: string) => comment[k] ?? '';
  const setC = (k: string, v: string) => setComment(s => ({ ...s, [k]: v }));

  const fire = (
    kind: Parameters<typeof newCloseoutEvent>[0]['kind'],
    role: Parameters<typeof newCloseoutEvent>[0]['role'],
    summary: string,
    patch?: Parameters<typeof newCloseoutEvent>[0]['patch'],
    detail?: string,
  ) => onApply([newCloseoutEvent({ kind, role, actor: me, index, title, summary, detail, patch })]);

  // ── Auditor ──
  const assign = () => {
    fire('case-assigned', 'Auditor', `Assigned ${obsRef} to ${owner}`, { observation: { closeout: { owner, auditor: me } } });
    setView('owner');
  };
  const reassign = () => fire('case-assigned', 'Auditor', `Reassigned ${obsRef} to ${owner}`, { observation: { closeout: { owner } } });
  /** Tie an escalation matrix to the whole observation, or to one plan when it
   *  belongs to a different department from the rest. */
  const setMatrix = (id: string, planIndex?: number) => {
    const name = escalationMatrices.byId(id)?.name;
    const plan = planIndex != null ? plans[planIndex] : undefined;
    const what = plan ? `${obsRef} · ${plan.title || `action plan ${planIndex! + 1}`}` : obsRef;
    fire('escalation-set', 'Auditor',
      id ? `Set the escalation matrix on ${what} to ${name}` : `Cleared the escalation matrix on ${what}`,
      planIndex != null
        ? { plan: { index: realIdx(planIndex), set: { escalationMatrixId: id || undefined } } }
        : { observation: { closeout: { escalationMatrixId: id || undefined } } });
  };

  /** What the chosen matrix actually does at this observation's severity —
   *  the cadence in one line, so the choice is not a name with no consequence. */
  const matrixLine = (plan?: AtrActionPlan): { name: string; cadence: string } | null => {
    const def = escalationMatrices.byId(resolveMatrixId(co, plan));
    if (!def) return null;
    return { name: def.name, cadence: summarizeMatrix(matrixForSeverity(def.set, obs.risk)) };
  };

  const decidePlan = (i: number, ok: boolean) => {
    const name = plans[i].title || `action plan ${i + 1}`;
    const note = c(`plan-${i}`).trim();
    const at = plans[i].approvalLevel ?? 0;
    // Approving at a level that is not the last hands the plan up the chain
    // rather than clearing it outright.
    const advance = ok && !lastLevel(at);
    fire(ok ? 'plan-accepted' : 'plan-rejected', 'Auditor',
      advance
        ? `Approved the action plan on ${obsRef} · ${name} — to ${levels[at + 1]?.approvers.join(', ') || 'the next approver'}`
        : ok ? `Approved the action plan on ${obsRef} · ${name}` : `Rejected the action plan on ${obsRef} · ${name}`,
      { plan: { index: realIdx(i), set: advance
        ? { approvalLevel: at + 1, planReviewComment: note || undefined, status: 'Pending' }
        : { planReview: ok ? 'Approved' : 'Rejected', approvalLevel: 0, planReviewComment: note || undefined, status: 'Pending' } } },
      note || undefined);
    setC(`plan-${i}`, '');
    setPlanDecision(d => ({ ...d, [i]: undefined }));
  };
  const decideAction = (i: number, outcome: ActionOutcome) => {
    const name = plans[i].title || `action plan ${i + 1}`;
    const note = c(`act-${i}`).trim();
    const rest = plans.filter((_, k) => k !== i);
    const lastOne = outcome === 'Implemented' && rest.every(planSettled);
    const events = [newCloseoutEvent({
      kind: outcome === 'Rejected' ? 'action-discrepancy' : 'action-verified', role: 'Auditor', actor: me, index, title,
      summary: outcome === 'Rejected'
        ? `Rejected the action taken on ${obsRef} · ${name} — back to the risk owner`
        : `Accepted the action taken on ${obsRef} · ${name} as ${outcome}`,
      detail: note || undefined,
      patch: {
        plan: {
          index: realIdx(i),
          set: outcome === 'Rejected'
            ? { status: 'Pending', actionTaken: '', verification: note || 'Rejected by the auditor — to be reworked.' }
            : { status: outcome, verification: note || undefined },
        },
      },
    })];
    if (lastOne) {
      events.push(newCloseoutEvent({
        kind: 'case-closed', role: 'Auditor', actor: me, index, title,
        summary: `Closed ${obsRef} — every action plan implemented`,
        patch: { observation: { status: 'Closed' } },
      }));
    }
    onApply(events);
    setC(`act-${i}`, '');
    setDecision(d => ({ ...d, [i]: undefined }));
  };

  // ── Risk owner ──
  const classifyTrue = () => {
    const made = newPlans.filter(p => p.title.trim() && p.text.trim() && p.due.trim());
    if (!sub || made.length === 0) return;
    const events = [newCloseoutEvent({
      kind: 'case-classified', role: 'Risk Owner', actor: me, index, title,
      summary: `Classified ${obsRef} as a True Exception · ${sub}`,
      detail: clsNote.trim() || undefined,
      patch: { observation: { closeout: { verdict: 'True Exception', classification: sub as AtrClassification, classificationComment: clsNote.trim() } } },
    })];
    made.forEach(p => events.push(newCloseoutEvent({
      kind: 'plan-submitted', role: 'Risk Owner', actor: me, index, title,
      summary: `Submitted an action plan on ${obsRef} · ${p.title.trim()}`,
      detail: p.text.trim(),
      patch: { plan: { set: { title: p.title.trim(), text: p.text.trim(), dueDate: p.due.trim(), status: 'Pending', planReview: 'Pending', closeout: true } } },
    })));
    onApply(events);
    setNewPlans([]);
    setView('auditor');
  };
  const classifyFalse = () => {
    if (!fpReason.trim()) return;
    // No status change here: a false positive closes nothing until the auditor
    // accepts it. `fpReview: 'Pending'` also clears any earlier rejection, so a
    // resubmitted call goes back to the auditor rather than looping.
    fire('case-classified', 'Risk Owner',
      `Submitted ${obsRef} as a False Positive — for the auditor to review`,
      { observation: { closeout: { verdict: 'False Positive', falsePositiveReason: fpReason.trim(), fpReview: 'Pending', fpReviewComment: '' } } },
      fpReason.trim());
    setView('auditor');
  };

  /** The auditor's call on a false positive. Accepting it closes the
   *  observation with no action plans; rejecting it hands it back. */
  const decideFalsePositive = (ok: boolean) => {
    const note = c('fp').trim();
    const events = [newCloseoutEvent({
      kind: ok ? 'case-classified' : 'plan-rejected', role: 'Auditor', actor: me, index, title,
      summary: ok
        ? `Accepted ${obsRef} as a False Positive`
        : `Rejected the false-positive call on ${obsRef} — back to the risk owner to reclassify`,
      detail: note || undefined,
      patch: { observation: { closeout: { fpReview: ok ? 'Approved' : 'Rejected', fpReviewComment: note } } },
    })];
    if (ok) {
      events.push(newCloseoutEvent({
        kind: 'case-closed', role: 'Auditor', actor: me, index, title,
        summary: `Closed ${obsRef} — accepted as a false positive, no action plans`,
        patch: { observation: { status: 'Closed' } },
      }));
    }
    onApply(events);
    setC('fp', '');
    setFpDecision(undefined);
  };
  const recordAction = (i: number) => {
    const t = taken[i];
    if (!t?.what.trim()) return;
    const name = plans[i].title || `action plan ${i + 1}`;
    fire('action-completed', 'Risk Owner', `Recorded the action taken on ${obsRef} · ${name}`,
      { plan: { index: realIdx(i), set: { actionTaken: t.what.trim(), verification: '', ...(t.evidence.trim() ? { evidence: t.evidence.trim() } : {}) } } },
      t.what.trim());
    setView('auditor');
  };

  const resubmitPlan = (i: number) => {
    const p = plans[i];
    const r = revise[i] ?? { title: p.title ?? '', text: p.text ?? '', due: p.dueDate ?? '' };
    if (!r.title.trim() || !r.text.trim() || !r.due.trim()) return;
    fire('plan-submitted', 'Risk Owner', `Resubmitted the action plan on ${obsRef} · ${r.title.trim()}`,
      { plan: { index: realIdx(i), set: { title: r.title.trim(), text: r.text.trim(), dueDate: r.due.trim(), status: 'Pending', planReview: 'Pending', planReviewComment: '' } } },
      r.text.trim());
    setRevise(s => ({ ...s, [i]: undefined }));
    setView('auditor');
  };

  const addPlanRow = () => setNewPlans(p => [...p, { title: '', text: '', due: '' }]);
  /** Copy an existing plan in as a new row. A due date that has already passed
   *  is dropped rather than carried over — the picker offers the wording, the
   *  risk owner still has to commit to a date they can meet. */
  const attachPlan = (e: ExistingPlan) => {
    const due = e.plan.dueDate && toIsoDate(e.plan.dueDate) >= isoToday() ? toIsoDate(e.plan.dueDate) : '';
    setNewPlans(p => [...p, { title: e.plan.title ?? '', text: e.plan.text ?? '', due }]);
    setPicking(false);
    setPickQuery('');
  };
  const alreadyAdded = (e: ExistingPlan) => newPlans.some(r => r.title.trim() === (e.plan.title ?? '').trim() && r.text.trim() === (e.plan.text ?? '').trim());
  const q = pickQuery.trim().toLowerCase();
  const pickable = existingPlans.filter(e => !q
    || (e.plan.title ?? '').toLowerCase().includes(q)
    || (e.plan.text ?? '').toLowerCase().includes(q)
    || e.from.toLowerCase().includes(q));
  const setPlanRow = (i: number, patch: Partial<{ title: string; text: string; due: string }>) =>
    setNewPlans(p => p.map((row, k) => (k === i ? { ...row, ...patch } : row)));

  const planState = (p: AtrActionPlan) =>
    planSettled(p) ? { text: p.status!, tone: TONE_DONE }
      : p.planReview === 'Rejected' ? { text: 'Plan rejected', tone: 'bg-risk-50 text-risk-700' }
      : !planApproved(p) ? { text: 'Awaiting plan approval', tone: TONE_WAIT }
      : !planActed(p) ? { text: 'In progress', tone: TONE_WAIT }
      : { text: 'Awaiting review', tone: TONE_WAIT };

  // ── The two sides ──
  const auditorView = (
    <>
      <Card key="a-assign" title="Assignment" state={co.owner ? { text: co.owner, tone: TONE_DONE } : { text: 'Not assigned', tone: TONE_WAIT }}
        defaultOpen={phase === 'unassigned'}
        note="Pick the risk owner who will classify this observation and carry out the fix. You stay on it as the auditor.">
        <label className="block">
          <span className={LABEL}>Risk owner</span>
          <select value={owner} onChange={e => setOwner(e.target.value)} className={FIELD}>
            <option value="">Choose a risk owner…</option>
            {PEOPLE.filter(p => p.role !== 'Auditor').map(p => <option key={p.id} value={p.name}>{p.name} · {p.role}</option>)}
          </select>
        </label>
        <div className="flex justify-end mt-3">
          <button type="button" onClick={co.owner ? reassign : assign} disabled={!owner || owner === co.owner} className={BTN_PRIMARY}>
            {co.owner ? 'Reassign' : 'Assign'}
          </button>
        </div>

        {policy && (
          <div className="mt-3 pt-3 border-t border-canvas-border">
            <p className={LABEL}>Approval flow</p>
            <p className="text-[0.8125rem] text-ink-800 leading-snug">{policy.name}</p>
            <p className="text-[0.6875rem] text-ink-500 leading-snug mt-0.5">
              {levels.length > 0
                ? `Action plans and action taken are signed off by ${chainLine(policy)}.`
                : 'Action plans and action taken take a single auditor sign-off.'}
              {' '}From the matrix below; set in Administration → Approval &amp; Escalation Matrix.
            </p>
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-canvas-border">
          <label className={LABEL} htmlFor="esc-obs">Escalation matrix</label>
          <select id="esc-obs" value={co.escalationMatrixId ?? ''} onChange={e => setMatrix(e.target.value)} className={FIELD}>
            <option value="">No escalation — nobody is chased</option>
            {matrices.map(m => (
              <option key={m.id} value={m.id}>{m.name}{m.department ? ` · ${m.department}` : ''}</option>
            ))}
          </select>
          <p className="text-[0.6875rem] text-ink-500 leading-snug mt-1.5">
            {(() => {
              const line = matrixLine();
              return line
                ? `Chases every action plan here: ${line.cadence}. A plan from another department can be pointed at a different matrix under Plan approval.`
                : 'Pick who chases a late action plan, and how far up it goes. Matrices are configured in Administration → Escalation Matrix.';
            })()}
          </p>
        </div>
      </Card>

      {co.verdict === 'False Positive' && (
        <Card key="a-fp" title="False positive review"
          state={co.fpReview === 'Approved' ? { text: 'Accepted', tone: TONE_DONE }
            : co.fpReview === 'Rejected' ? { text: 'Sent back', tone: 'bg-risk-50 text-risk-700' }
            : { text: 'Waiting on you', tone: TONE_WAIT }}
          defaultOpen={phase === 'fp-review'}
          note="The risk owner says there is nothing to fix here. Accepting closes the observation with no action plans, so it is worth reading the reason first.">
          <div className="rounded-md border border-canvas-border px-3 py-2.5 mb-2">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-500 mb-1">Reason given</p>
            <p className="text-[0.8125rem] text-ink-800 leading-snug">{co.falsePositiveReason || 'No reason recorded.'}</p>
            {co.fpReviewComment && <p className="text-[0.71875rem] text-ink-500 italic mt-1.5">{co.fpReviewComment}</p>}
          </div>
          {co.fpReview === 'Approved'
            ? <p className="text-[0.75rem] text-compliant-700">Accepted — the observation is closed with no action plans.</p>
            : co.fpReview === 'Rejected'
              ? <p className="text-[0.75rem] text-ink-500">Sent back to {co.owner ?? 'the risk owner'} — waiting on a fresh classification.</p>
              : (
                <div className="space-y-2">
                  <textarea rows={2} value={c('fp')} onChange={e => setC('fp', e.target.value)} placeholder="Comment — required to reject" className={AREA} />
                  <div role="radiogroup" aria-label={`Decision on the false-positive call for ${obsRef}`} className="flex flex-wrap items-center gap-1.5">
                    {PLAN_OUTCOMES.map(o => {
                      const picked = fpDecision === o.value;
                      return (
                        <button key={o.value} type="button" role="radio" aria-checked={picked}
                          onClick={() => setFpDecision(picked ? undefined : o.value)}
                          className={`${CHOICE} ${picked ? o.on : CHOICE_OFF}`}>
                          {picked && <Check size={13} aria-hidden="true" />}
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[0.6875rem] text-ink-500 min-w-0">
                      {!fpDecision
                        ? 'Pick an outcome to record your decision.'
                        : fpDecision === 'Rejected'
                          ? 'A reason is required before a rejection can be submitted.'
                          : 'Closes the observation with no action plans.'}
                    </p>
                    <button type="button"
                      onClick={() => { if (fpDecision) decideFalsePositive(fpDecision === 'Approved'); }}
                      disabled={!fpDecision || (fpDecision === 'Rejected' && !c('fp').trim())}
                      className={BTN_PRIMARY}>
                      Submit decision
                    </button>
                  </div>
                </div>
              )}
        </Card>
      )}

      <Card key="a-plan" title="Plan approval" state={plans.length === 0 ? { text: 'Nothing submitted', tone: TONE_IDLE } : plans.every(planApproved) ? { text: 'Approved', tone: TONE_DONE } : { text: `${plans.filter(planApproved).length} of ${plans.length}`, tone: TONE_WAIT }}
        defaultOpen={phase === 'plan-review'}
        note="The risk owner proposes how they will fix it. Approve the plan to let the work start, or send it back with what needs changing.">
        {plans.length === 0
          ? <p className="text-[0.75rem] text-ink-500">No action plans yet — they arrive once the risk owner classifies this as a true exception.</p>
          : plans.map((p, i) => (
            <div key={i} className="rounded-md border border-canvas-border px-3 py-2.5 mb-2 last:mb-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[0.8125rem] font-semibold text-ink-900 leading-snug min-w-0">{p.title || `Action plan ${i + 1}`}</p>
                {pill(p.planReview ?? 'Not submitted', p.planReview === 'Approved' ? TONE_DONE : p.planReview === 'Rejected' ? 'bg-risk-50 text-risk-700' : TONE_WAIT)}
              </div>
              {p.text && <p className="text-[0.71875rem] text-ink-600 leading-snug mt-1">{p.text}</p>}
              {p.dueDate && <p className="text-[0.6875rem] text-ink-400 mt-1">Due {p.dueDate}{co.owner ? ` · ${co.owner}` : ''}</p>}
              {p.planReviewComment && <p className="text-[0.6875rem] text-ink-500 italic mt-1">{p.planReviewComment}</p>}
              {(() => {
                const line = matrixLine(p);
                return (
                  <div className="mt-2 pt-2 border-t border-canvas-border/70">
                    <label className="block text-[0.625rem] font-semibold uppercase tracking-wide text-ink-400 mb-1" htmlFor={`esc-plan-${i}`}>Escalation matrix</label>
                    <select id={`esc-plan-${i}`} value={p.escalationMatrixId ?? ''} onChange={e => setMatrix(e.target.value, i)}
                      className="w-full h-8 px-2 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-900 outline-none focus:border-brand-400">
                      <option value="">
                        {co.escalationMatrixId ? `Use the observation's — ${escalationMatrices.byId(co.escalationMatrixId)?.name ?? 'none'}` : 'Use the observation\u2019s — none set'}
                      </option>
                      {matrices.map(m => (
                        <option key={m.id} value={m.id}>{m.name}{m.department ? ` · ${m.department}` : ''}</option>
                      ))}
                    </select>
                    <p className="text-[0.625rem] text-ink-400 leading-snug mt-1">
                      {line ? `${line.name} · ${line.cadence}` : 'Nothing is chasing this plan if it runs late.'}
                    </p>
                  </div>
                );
              })()}
              {planRejected(p)
                ? <p className="text-[0.71875rem] text-ink-500 mt-1.5">Sent back to {co.owner ?? 'the risk owner'} — waiting on a revised plan.</p>
                : p.planReview !== 'Approved' && (
                <div className="mt-2 space-y-2">
                  <textarea rows={2} value={c(`plan-${i}`)} onChange={e => setC(`plan-${i}`, e.target.value)} placeholder="Comment — required to reject" className={AREA} />
                  <div role="radiogroup" aria-label={`Decision on ${p.title || `action plan ${i + 1}`}`} className="flex flex-wrap items-center gap-1.5">
                    {PLAN_OUTCOMES.map(o => {
                      const picked = planDecision[i] === o.value;
                      return (
                        <button key={o.value} type="button" role="radio" aria-checked={picked}
                          onClick={() => setPlanDecision(d => ({ ...d, [i]: picked ? undefined : o.value }))}
                          className={`${CHOICE} ${picked ? o.on : CHOICE_OFF}`}>
                          {picked && <Check size={13} aria-hidden="true" />}
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                  {gateLine(p.approvalLevel) && (
                    <p className="text-[0.6875rem] text-ink-500">
                      <span className="font-semibold text-ink-600">With:</span> {gateLine(p.approvalLevel)}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[0.6875rem] text-ink-500 min-w-0">
                      {!planDecision[i]
                        ? 'Pick an outcome to record your decision.'
                        : planDecision[i] === 'Rejected'
                          ? 'A reason is required before a rejection can be submitted.'
                          : 'Approves the plan so the risk owner can start the work.'}
                    </p>
                    <button type="button"
                      onClick={() => { const d = planDecision[i]; if (d) decidePlan(i, d === 'Approved'); }}
                      disabled={!planDecision[i] || (planDecision[i] === 'Rejected' && !c(`plan-${i}`).trim())}
                      className={BTN_PRIMARY}>
                      Submit decision
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
      </Card>

      <Card key="a-review" title="Action review" state={plans.length === 0 ? { text: 'Nothing to review', tone: TONE_IDLE } : plans.every(planSettled) ? { text: 'Done', tone: TONE_DONE } : { text: `${plans.filter(planSettled).length} of ${plans.length}`, tone: TONE_WAIT }}
        defaultOpen={phase === 'action-review'}
        note="Check what the risk owner actually did, pick an outcome and submit it. Implemented closes the plan; Partially Implemented keeps it open; Reject sends it back to be reworked.">
        {plans.filter(planActed).length === 0
          ? <p className="text-[0.75rem] text-ink-500">Nothing to review yet — the risk owner has not recorded any action taken.</p>
          : plans.map((p, i) => (!planActed(p) ? null : (
            <div key={i} className="rounded-md border border-canvas-border px-3 py-2.5 mb-2 last:mb-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[0.8125rem] font-semibold text-ink-900 leading-snug min-w-0">{p.title || `Action plan ${i + 1}`}</p>
                {pill(planState(p).text, planState(p).tone)}
              </div>
              <p className="text-[0.71875rem] text-ink-600 leading-snug mt-1.5"><span className="font-semibold text-ink-700">Action taken:</span> {p.actionTaken}</p>
              {p.evidence && <p className="text-[0.6875rem] text-ink-500 mt-0.5"><span className="font-semibold text-ink-600">Evidence:</span> {p.evidence}</p>}
              {p.verification && <p className="text-[0.6875rem] text-ink-500 italic mt-0.5">{p.verification}</p>}
              {!planSettled(p) && (
                <div className="mt-2 space-y-2">
                  <textarea rows={2} value={c(`act-${i}`)} onChange={e => setC(`act-${i}`, e.target.value)} placeholder="Reason — required to reject" className={AREA} />
                  <div role="radiogroup" aria-label={`Decision on ${p.title || `action plan ${i + 1}`}`} className="flex flex-wrap items-center gap-1.5">
                    {OUTCOMES.map(o => {
                      const picked = decision[i] === o.value;
                      return (
                        <button key={o.value} type="button" role="radio" aria-checked={picked}
                          onClick={() => setDecision(d => ({ ...d, [i]: picked ? undefined : o.value }))}
                          className={`${CHOICE} ${picked ? o.on : CHOICE_OFF}`}>
                          {picked && <Check size={13} aria-hidden="true" />}
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[0.6875rem] text-ink-500 min-w-0">
                      {!decision[i]
                        ? 'Pick an outcome to record your decision.'
                        : decision[i] === 'Rejected'
                          ? 'A reason is required before a rejection can be submitted.'
                          : `Records the action taken as ${decision[i]}.`}
                    </p>
                    <button type="button"
                      onClick={() => { const d = decision[i]; if (d) decideAction(i, d); }}
                      disabled={!decision[i] || (decision[i] === 'Rejected' && !c(`act-${i}`).trim())}
                      className={BTN_PRIMARY}>
                      Submit decision
                    </button>
                  </div>
                </div>
              )}
            </div>
          )))}
      </Card>
    </>
  );

  const ownerView = (
    <>
      <Card key="o-class" title="Classification" state={co.verdict ? { text: co.verdict, tone: falsePositive ? TONE_IDLE : TONE_DONE } : { text: 'Not classified', tone: TONE_WAIT }}
        defaultOpen={phase === 'classify'}
        note={co.owner ? undefined : 'Waiting on the auditor to assign a risk owner.'}>
        {!co.owner ? <p className="text-[0.75rem] text-ink-500">Nothing to do yet.</p> : co.verdict && !fpSentBack ? (
          <div className="space-y-1.5">
            <p className="text-[0.8125rem] text-ink-800"><span className="font-semibold">{co.verdict}</span>{co.classification ? ` · ${co.classification}` : ''}</p>
            {co.falsePositiveReason && <p className="text-[0.75rem] text-ink-600 leading-snug">{co.falsePositiveReason}</p>}
            {co.classificationComment && <p className="text-[0.75rem] text-ink-600 leading-snug">{co.classificationComment}</p>}
            {co.verdict === 'False Positive' && co.fpReview !== 'Approved' && (
              <p className="text-[0.71875rem] text-mitigated-700">With the auditor to accept or reject this call.</p>
            )}
          </div>
        ) : (
          <>
            {fpSentBack && (
              <div className="rounded-md border border-risk-200 bg-risk-50/50 px-3 py-2.5 mb-3">
                <p className="text-[0.71875rem] font-semibold text-risk-700">The auditor rejected the false-positive call.</p>
                <p className="text-[0.71875rem] text-ink-700 leading-snug mt-0.5">{co.fpReviewComment || 'See the auditor’s comment.'}</p>
              </div>
            )}
            <div className="flex gap-2 mb-3">
              <ChoiceTile on={verdict === 'True Exception'} title="True Exception" sub="Sub-class + one or more action plans" onClick={() => setVerdict('True Exception')} />
              <ChoiceTile on={verdict === 'False Positive'} title="False Positive" sub="Reason, no action plans — the auditor signs it off" onClick={() => setVerdict('False Positive')} />
            </div>

            {verdict === 'True Exception' && (
              <>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {SUBCLASSES.map(s => (
                    <button key={s} type="button" onClick={() => setSub(s)} aria-pressed={sub === s}
                      className={`h-7 px-2.5 rounded-full border text-[0.75rem] font-medium cursor-pointer transition-colors ${sub === s ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-canvas-border text-ink-600 hover:border-brand-200'}`}>{s}</button>
                  ))}
                </div>
                <textarea rows={2} value={clsNote} onChange={e => setClsNote(e.target.value)} placeholder="Classification comment…" className={`${AREA} mb-3`} />
                <p className={LABEL}>Action plans <span className="text-risk-600">*</span></p>
                {newPlans.length === 0 && <p className="text-[0.71875rem] text-ink-500 mb-2">No plans added yet — at least one is required.</p>}
                {newPlans.map((row, i) => (
                  <div key={i} className="rounded-md border border-canvas-border px-3 py-2.5 mb-2 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-500">Plan {i + 1}</span>
                      <button type="button" onClick={() => setNewPlans(p => p.filter((_, k) => k !== i))} aria-label={`Remove plan ${i + 1}`} className="w-6 h-6 rounded-md text-ink-400 hover:text-risk-700 hover:bg-risk-50 flex items-center justify-center cursor-pointer"><Trash2 size={12} /></button>
                    </div>
                    <input value={row.title} onChange={e => setPlanRow(i, { title: e.target.value })} placeholder="Title * — e.g. Reverse duplicate invoice postings" className={FIELD} />
                    <textarea rows={2} value={row.text} onChange={e => setPlanRow(i, { text: e.target.value })} placeholder="What must be done, and what evidence closes it? *" className={AREA} />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-9 px-2.5 rounded-md border border-canvas-border bg-canvas flex items-center text-[0.75rem] text-ink-500">Owner · <span className="font-semibold text-ink-800 ml-1">{co.owner}</span></div>
                      <DatePicker
                        value={row.due}
                        min={isoToday()}
                        onChange={e => setPlanRow(i, { due: e.target.value })}
                        placeholder="Due date *"
                        aria-label={`Due date for plan ${i + 1}`}
                        className={`${FIELD} cursor-pointer`}
                      />
                    </div>
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  <button type="button" onClick={addPlanRow} className={BTN_QUIET}><Plus size={13} aria-hidden="true" /> New plan</button>
                  <button type="button" onClick={() => setPicking(v => !v)} aria-expanded={picking} disabled={existingPlans.length === 0}
                    title={existingPlans.length === 0 ? 'No other observation in this report carries an action plan yet' : 'Reuse an action plan already written in this report'}
                    className={BTN_QUIET}>
                    <Link2 size={13} aria-hidden="true" /> Attach existing
                    {existingPlans.length > 0 && <span className="tabular-nums text-ink-400">({existingPlans.length})</span>}
                  </button>
                </div>
                {picking && (
                  <div className="rounded-md border border-canvas-border bg-canvas/40 mb-3">
                    <div className="relative border-b border-canvas-border">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" aria-hidden="true" />
                      <input value={pickQuery} onChange={e => setPickQuery(e.target.value)} placeholder="Search plans already in this report…" aria-label="Search existing action plans"
                        className="w-full h-9 pl-8 pr-2.5 bg-transparent text-[0.8125rem] text-ink-900 outline-none placeholder:text-ink-400" />
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {pickable.length === 0
                        ? <p className="px-3 py-3 text-[0.71875rem] text-ink-500">No plan matches “{pickQuery}”.</p>
                        : pickable.map((e, k) => {
                          const added = alreadyAdded(e);
                          return (
                            <button key={k} type="button" onClick={() => attachPlan(e)} disabled={added}
                              className="w-full text-left px-3 py-2.5 border-b border-canvas-border last:border-b-0 hover:bg-brand-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors">
                              <span className="flex items-center gap-2 flex-wrap">
                                <span className="text-[0.75rem] font-semibold text-ink-900">{e.plan.title || `Action plan from ${e.from}`}</span>
                                {added && pill('Added', TONE_DONE)}
                              </span>
                              {e.plan.text && <span className="block text-[0.6875rem] text-ink-600 leading-snug mt-0.5 line-clamp-2">{e.plan.text}</span>}
                              <span className="block text-[0.625rem] text-ink-400 mt-0.5">From {e.from}{e.plan.dueDate ? ` · was due ${e.plan.dueDate}` : ''}</span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
                <div className="flex justify-end">
                  <button type="button" onClick={classifyTrue} disabled={!sub || newPlans.filter(p => p.title.trim() && p.text.trim() && p.due.trim()).length === 0} className={BTN_PRIMARY}>Classify &amp; submit plans</button>
                </div>
              </>
            )}

            {verdict === 'False Positive' && (
              <>
                <textarea rows={3} value={fpReason} onChange={e => setFpReason(e.target.value)} placeholder="Reason for false positive (required)…" className={`${AREA} mb-3`} />
                <div className="flex justify-end">
                  <button type="button" onClick={classifyFalse} disabled={!fpReason.trim()} className={BTN_PRIMARY}>Classify</button>
                </div>
              </>
            )}
          </>
        )}
      </Card>

      <Card key="o-taken" title="Action plans" state={plans.length === 0 ? { text: 'No plans', tone: TONE_IDLE } : plans.some(planRejected) ? { text: `${plans.filter(planRejected).length} sent back`, tone: 'bg-risk-50 text-risk-700' } : plans.every(planActed) ? { text: 'Recorded', tone: TONE_DONE } : { text: `${plans.filter(planActed).length} of ${plans.length}`, tone: TONE_WAIT }}
        defaultOpen={phase === 'in-progress' || phase === 'replan'}
        note="Revise anything the auditor sent back and resubmit it. Once a plan is approved, record what you actually did and the evidence that proves it.">
        {plans.length === 0
          ? <p className="text-[0.75rem] text-ink-500">Nothing yet — classify this as a true exception and add an action plan first.</p>
          : plans.map((p, i) => {
            const t = taken[i] ?? { what: p.actionTaken ?? '', evidence: p.evidence ?? '' };
            const locked = !planApproved(p);
            return (
              <div key={i} className={`rounded-md border px-3 py-2.5 mb-2 last:mb-0 ${planActed(p) ? 'border-compliant-200 bg-compliant-50/40' : 'border-canvas-border'}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[0.8125rem] font-semibold text-ink-900 leading-snug min-w-0">{p.title || `Action plan ${i + 1}`}</p>
                  {pill(planState(p).text, planState(p).tone)}
                </div>
                {p.dueDate && <p className="text-[0.6875rem] text-ink-400 mt-0.5">Due {p.dueDate}</p>}
                {planRejected(p) ? (() => {
                  const r = revise[i] ?? { title: p.title ?? '', text: p.text ?? '', due: p.dueDate ?? '' };
                  const setR = (patch: Partial<typeof r>) => setRevise(s => ({ ...s, [i]: { ...r, ...patch } }));
                  return (
                    <div className="mt-2 space-y-2">
                      <p className="text-[0.71875rem] text-risk-700 leading-snug">Sent back: {p.planReviewComment || 'see the auditor’s comment'}</p>
                      <input value={r.title} onChange={e => setR({ title: e.target.value })} placeholder="Title *" aria-label={`Revised title for plan ${i + 1}`} className={FIELD} />
                      <textarea rows={2} value={r.text} onChange={e => setR({ text: e.target.value })} placeholder="What must be done, and what evidence closes it? *" className={AREA} />
                      <DatePicker
                        value={r.due}
                        min={isoToday()}
                        onChange={e => setR({ due: e.target.value })}
                        placeholder="Due date *"
                        aria-label={`Revised due date for plan ${i + 1}`}
                        className={`${FIELD} cursor-pointer`}
                      />
                      <button type="button" onClick={() => resubmitPlan(i)} disabled={!r.title.trim() || !r.text.trim() || !r.due.trim()} className={BTN_PRIMARY}>
                        <Check size={13} aria-hidden="true" /> Resubmit for approval
                      </button>
                    </div>
                  );
                })()
                  : locked
                  ? <p className="text-[0.71875rem] text-ink-500 mt-1.5">Waiting on the auditor to approve this plan.</p>
                  : planSettled(p)
                    ? <p className="text-[0.71875rem] text-ink-600 mt-1.5"><span className="font-semibold">Action taken:</span> {p.actionTaken}</p>
                    : (
                      <div className="mt-2 space-y-2">
                        <textarea rows={2} value={t.what} onChange={e => setTaken(s => ({ ...s, [i]: { ...t, what: e.target.value } }))} placeholder="What did you do to fix it?" className={AREA} />
                        <span className="relative block">
                          <Paperclip size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" aria-hidden="true" />
                          <input value={t.evidence} onChange={e => setTaken(s => ({ ...s, [i]: { ...t, evidence: e.target.value } }))} placeholder="Evidence — screenshot, ticket, sign-off" className={`${FIELD} pl-8`} />
                        </span>
                        <button type="button" onClick={() => recordAction(i)} disabled={!t.what.trim()} className={BTN_PRIMARY}>
                          <Check size={13} aria-hidden="true" /> {planActed(p) ? 'Update' : 'Submit'} for review
                        </button>
                      </div>
                    )}
              </div>
            );
          })}
      </Card>
    </>
  );

  const roleBtn = (r: CloseoutRole, label: string) => (
    <button type="button" onClick={() => setView(r)} aria-pressed={view === r}
      className={`relative flex-1 h-8 rounded-md text-[0.75rem] font-semibold cursor-pointer transition-colors ${view === r ? 'bg-canvas-elevated text-brand-700 shadow-sm' : 'text-ink-600 hover:text-ink-900'}`}>
      {label}
      {actor === r && <span className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full bg-brand-600" title="Waiting on this role" />}
    </button>
  );

  return createPortal(
    <AnimatePresence>
      {open && (
        <div key="atr-closeout" className="fixed inset-0 z-[75] print:hidden">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.16 }} className="absolute inset-0 bg-ink-900/25" onClick={onClose} aria-hidden="true" />
          <motion.aside
            role="dialog" aria-label={`Manage ${title}`}
            initial={{ x: reduce ? 0 : '100%' }} animate={{ x: 0 }} exit={{ x: reduce ? 0 : '100%' }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 42, mass: 0.8 }}
            className="absolute right-0 top-0 bottom-0 w-full max-w-[560px] bg-canvas-elevated border-l border-canvas-border shadow-[0_8px_28px_-8px_rgb(15_8_30_/_0.28)] flex flex-col"
          >
            <header className="shrink-0 px-5 pt-4 pb-3 border-b border-canvas-border">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-ink-400">{obsRef} · Manage observation</p>
                  <h2 className="text-[0.9375rem] font-semibold text-ink-900 leading-tight mt-0.5 truncate">{title}</h2>
                  <p className="text-[0.71875rem] text-ink-500 mt-0.5 truncate">
                    {[obs.process, obs.risk, co.owner && `Owner ${co.owner}`].filter(Boolean).join(' · ') || 'Not yet assigned'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {closed && pill(falsePositive ? 'False positive' : 'Closed', TONE_DONE)}
                  <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-md text-ink-500 hover:text-ink-800 hover:bg-canvas flex items-center justify-center cursor-pointer"><X size={17} /></button>
                </div>
              </div>

              {/* Whose actions you are looking at. The dot marks whose move it is. */}
              <div role="group" aria-label="Show actions for" className="mt-3 flex items-center gap-1 p-1 rounded-lg bg-canvas border border-canvas-border">
                {roleBtn('auditor', 'Auditor')}
                {roleBtn('owner', 'Risk Owner')}
              </div>
              <p className="text-[0.6875rem] text-ink-500 mt-2 leading-snug">{PHASE_TEXT[phase]}</p>
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
              {view === 'auditor' ? auditorView : ownerView}

              {/* The complete record — every action, newest first. */}
              <Card key="trail" title="Audit trail" state={{ text: String(trail.length), tone: TONE_IDLE }} defaultOpen={closed}>
                {trail.length === 0
                  ? <p className="text-[0.75rem] text-ink-500">Nothing recorded on this observation yet.</p>
                  : (
                    <ul className="space-y-2.5">
                      {trail.map(e => (
                        <li key={e.id} className="flex gap-2.5">
                          <History size={12} className="text-ink-300 mt-1 shrink-0" aria-hidden="true" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`inline-flex items-center h-[17px] px-1.5 rounded-full text-[0.5625rem] font-semibold ${ROLE_TONE[e.role]}`}>{e.role}</span>
                              <span className="text-[0.625rem] text-ink-400 tabular-nums">{fmtEventTime(e.ts)}</span>
                            </div>
                            <p className="text-[0.75rem] text-ink-800 leading-snug mt-0.5">{e.summary}</p>
                            {e.detail && <p className="text-[0.6875rem] text-ink-500 leading-snug mt-0.5 whitespace-pre-line">{e.detail}</p>}
                            <p className="text-[0.625rem] text-ink-400 mt-0.5">{e.actor}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
              </Card>
            </div>

            <div className="shrink-0 border-t border-canvas-border px-5 py-3 flex items-center justify-between gap-3">
              <p className="text-[0.6875rem] text-ink-400 min-w-0 leading-snug truncate">
                {closed ? (falsePositive ? 'Closed as a false positive.' : 'Closed — every action plan implemented.') : PHASE_TEXT[phase]}
              </p>
              <button type="button" onClick={onClose} className={closed ? BTN_GOOD : BTN_QUIET}>
                {closed && <ShieldCheck size={14} aria-hidden="true" />} Done
              </button>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
