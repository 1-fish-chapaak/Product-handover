// ─── ATR Report Snapshot timeline ───
// An Action Taken Report keeps changing after it is generated: the preparer
// edits it in the reader, and — far more often — the Risk Owner and the Auditor
// move its cases through case management (classify, submit an action plan,
// accept it, mark it complete with evidence, verify the outcome, revise due
// dates, close). Report Snapshot answers "what did this ATR say, and what had been
// done, as of <moment>?".
//
// The model is an append-only ledger per report:
//   baseline  — the ATR exactly as it was generated
//   events    — every change since, each stamped with when / who / which role,
//               a human summary, and a data-level `patch` that reproduces the
//               change on the report
// The report "as of T" is the baseline with every event up to T replayed over
// it, so there is one source of truth for both the timeline list and the
// document the user sees. The latest state is simply "as of now".
//
// Persistence is localStorage (like the rest of the prototype) so case actions
// taken in the Manage Exceptions tab — which opens in a separate browser tab —
// still reach the report, and the reader picks them up live via `storage`.

import type { AtrReportData, AtrObservation, AtrActionPlan, AtrLinkedAnnexure, AtrObservationStatus, AtrActionStatus } from './atrTypes';
import type { GrcException, GrcCaseDetail } from '../../data/mockData';

export type AtrEventRole = 'Auditor' | 'Risk Owner' | 'Preparer' | 'System';
export type AtrEventKind =
  | 'generated' | 'edited' | 'regenerated'
  | 'case-assigned' | 'case-classified'
  | 'plan-submitted' | 'plan-accepted' | 'plan-rejected'
  | 'action-completed' | 'action-verified' | 'action-discrepancy'
  | 'due-date-requested' | 'due-date-approved' | 'due-date-rejected'
  | 'case-closed'
  | 'annexure-linked' | 'annexure-unlinked';

/** A data-level change to replay on the report. Targets an observation by
 *  index (with its title as a fallback if the report was reordered), and an
 *  action plan by the case it tracks — a case's first plan event creates the
 *  plan, later ones update it. `replace` swaps in a whole snapshot (used for
 *  inline edits, where a field-by-field patch would be lossy). */
export interface AtrEventPatch {
  replace?: AtrReportData;
  observationIndex?: number;
  observationTitle?: string;
  observation?: { status?: AtrObservationStatus; classification?: AtrObservation['classification']; classificationIfEmpty?: boolean };
  plan?: { caseId?: string; index?: number; set: Partial<AtrActionPlan> };
  /** Link / unlink supporting annexures on the observation. */
  annexures?: { add?: AtrLinkedAnnexure[]; removeId?: string };
}

export interface AtrEvent {
  id: string;
  /** ISO timestamp. */
  ts: string;
  actor: string;
  role: AtrEventRole;
  kind: AtrEventKind;
  /** One line, e.g. "Marked the action complete — evidence attached". */
  summary: string;
  /** Optional longer text (a comment, the plan text, a reason). */
  detail?: string;
  caseId?: string;
  observationIndex?: number;
  observationTitle?: string;
  patch?: AtrEventPatch;
}

export interface AtrTimeline {
  baseline: AtrReportData;
  events: AtrEvent[];
}

const KEY = (reportId: string) => `irame.atr.timeline.v1.${reportId}`;
/** Exposed so the reader can react to writes from other tabs (`storage` event). */
export const atrTimelineKey = KEY;

function read(reportId: string): AtrTimeline | null {
  try { const raw = localStorage.getItem(KEY(reportId)); return raw ? (JSON.parse(raw) as AtrTimeline) : null; } catch { return null; }
}
function write(reportId: string, t: AtrTimeline) {
  try { localStorage.setItem(KEY(reportId), JSON.stringify(t)); } catch { /* quota — the reader falls back to the saved snapshot */ }
}

const newId = () => `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const byTs = (a: AtrEvent, b: AtrEvent) => Date.parse(a.ts) - Date.parse(b.ts);

/** Parse the prototype's display stamps ("17 Sept 2026, 15:38" / "Mar 19, 2026")
 *  or ISO into a Date; falls back to `fallback`. */
export function parseStamp(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;
  const d2 = new Date(s.replace(/(\d{1,2}) (\w{3,4}) (\d{4}), (\d{2}):(\d{2})/, '$2 $1, $3 $4:$5'));
  return Number.isNaN(d2.getTime()) ? fallback : d2;
}

// ─── Load / seed ───

export interface TimelineSeed {
  /** When the report was generated (display stamp or ISO). */
  generatedAt?: string;
  preparedBy?: string;
  /** Actors for the seeded case history of curated demo ATRs. */
  auditor?: string;
  riskOwner?: string;
  /** Seed a believable remediation history (curated demo ATRs only). A report
   *  the user generated starts truthfully: baseline = as generated, no events. */
  seedHistory?: boolean;
}

/** The timeline for a report, creating it from the saved snapshot on first use. */
export function loadTimeline(reportId: string, data: AtrReportData, seed: TimelineSeed): AtrTimeline {
  const existing = read(reportId);
  if (existing?.baseline) return existing;
  const t = seed.seedHistory ? seedDemoHistory(data, seed) : {
    baseline: data,
    events: [{
      id: newId(), ts: parseStamp(seed.generatedAt, new Date()).toISOString(),
      actor: seed.preparedBy || 'You', role: 'Preparer', kind: 'generated',
      summary: 'Action Taken Report generated',
    } satisfies AtrEvent],
  };
  write(reportId, t);
  return t;
}

export function appendEvents(reportId: string, events: AtrEvent[]): AtrTimeline | null {
  const t = read(reportId);
  if (!t) return null;
  const next = { ...t, events: [...t.events, ...events].sort(byTs) };
  write(reportId, next);
  return next;
}

export function hasTimeline(reportId: string): boolean { return !!read(reportId); }

// ─── Replay ───

const ACTIONABLE_CLASSES = new Set(['Design Deficiency', 'System Deficiency', 'Procedural Non-Compliance']);

/** Observation status implied by its action plans (unless an event set it). */
function deriveObservationStatus(o: AtrObservation): AtrObservationStatus | undefined {
  const plans = o.actionPlans ?? [];
  if (plans.length === 0) return o.status;
  if (plans.every(p => p.status === 'Implemented')) return 'Closed';
  if (plans.some(p => p.status === 'Overdue')) return 'Overdue';
  if (plans.some(p => p.status === 'Implemented' || p.status === 'Partially Implemented' || !!p.actionTaken)) return 'In Progress';
  return o.status === 'Closed' ? 'In Progress' : (o.status ?? 'Open');
}

function applyPatch(data: AtrReportData, patch: AtrEventPatch): AtrReportData {
  if (patch.replace) return patch.replace;
  const observations = data.observations.map(o => ({ ...o, actionPlans: [...(o.actionPlans ?? [])] }));
  let idx = patch.observationIndex ?? -1;
  if ((idx < 0 || idx >= observations.length) && patch.observationTitle) idx = observations.findIndex(o => o.title === patch.observationTitle);
  if (idx < 0 || idx >= observations.length) return data;
  const obs = observations[idx];
  let explicitStatus: AtrObservationStatus | undefined;
  if (patch.observation) {
    const po = patch.observation;
    if (po.classification && (!po.classificationIfEmpty || !obs.classification)) obs.classification = po.classification;
    if (po.status) explicitStatus = po.status;
  }
  if (patch.plan) {
    const { caseId, index, set } = patch.plan;
    let pi = caseId ? obs.actionPlans.findIndex(p => p.caseId === caseId) : -1;
    if (pi < 0 && index != null && index < obs.actionPlans.length) pi = index;
    if (pi < 0) {
      // A case's first plan event creates its plan on the observation.
      if (set.text || set.title) obs.actionPlans.push({ text: set.text ?? set.title ?? '', ...set, caseId });
    } else {
      obs.actionPlans[pi] = { ...obs.actionPlans[pi], ...set };
    }
  }
  if (patch.annexures) {
    const cur = obs.linkedAnnexures ?? [];
    const withAdds = patch.annexures.add ? [...cur, ...patch.annexures.add.filter(a => !cur.some(c => c.id === a.id))] : cur;
    obs.linkedAnnexures = patch.annexures.removeId ? withAdds.filter(a => a.id !== patch.annexures!.removeId) : withAdds;
  }
  obs.status = explicitStatus ?? deriveObservationStatus(obs);
  return { ...data, observations };
}

/** The report as it stood at `asOf` (ISO); omit for the latest state. */
export function replay(timeline: AtrTimeline, asOf?: string): AtrReportData {
  const limit = asOf ? Date.parse(asOf) : Infinity;
  let data = timeline.baseline;
  for (const ev of [...timeline.events].sort(byTs)) {
    if (Date.parse(ev.ts) > limit) break;
    if (ev.patch) data = applyPatch(data, ev.patch);
  }
  return data;
}

/** Events applied by `asOf` (inclusive) vs. still to come. */
export function splitEvents(timeline: AtrTimeline, asOf?: string): { applied: AtrEvent[]; later: AtrEvent[] } {
  const limit = asOf ? Date.parse(asOf) : Infinity;
  const sorted = [...timeline.events].sort(byTs);
  return { applied: sorted.filter(e => Date.parse(e.ts) <= limit), later: sorted.filter(e => Date.parse(e.ts) > limit) };
}

// ─── Events from the reader (inline edits) ───

export function editEvent(next: AtrReportData, actor: string, changes: string[]): AtrEvent {
  const summary = changes.length === 0 ? 'Edited the report'
    : changes.length === 1 ? changes[0]
    : `Edited ${changes.length} details in the report`;
  return {
    id: newId(), ts: new Date().toISOString(), actor, role: 'Preparer', kind: 'edited',
    summary, detail: changes.length > 1 ? changes.join('\n') : undefined,
    patch: { replace: next },
  };
}

/** The ATR regenerated from its extracted observations (edited in Create
 *  Report → Observations Extracted). Replaces the report content wholesale,
 *  with the case links and status carried over by `carryCaseState`. */
export function regeneratedEvent(next: AtrReportData, actor: string, detail?: string, summary = 'Regenerated from the extracted observations'): AtrEvent {
  return {
    id: newId(), ts: new Date().toISOString(), actor, role: 'Preparer', kind: 'regenerated',
    summary, detail,
    patch: { replace: next },
  };
}

/** Regenerating rebuilds the observations from the wizard; anything case
 *  management attached to the saved report — plan case ids, observation status,
 *  linked annexures — is carried onto the matching observation (by source id,
 *  falling back to title) so the remediation trail is not lost. */
export function carryCaseState(prev: AtrReportData, next: AtrReportData): AtrReportData {
  const find = (o: AtrObservation) => prev.observations.find(p => (o.sourceObservationId && p.sourceObservationId === o.sourceObservationId) || (!!o.title && p.title === o.title));
  return {
    ...next,
    observations: next.observations.map(o => {
      const p = find(o);
      if (!p) return o;
      const plans = (o.actionPlans ?? []).map((pl, i) => {
        const pp = p.actionPlans?.[i];
        return pp?.caseId && !pl.caseId ? { ...pl, caseId: pp.caseId } : pl;
      });
      return {
        ...o,
        status: p.status ?? o.status,
        linkedAnnexures: p.linkedAnnexures?.length ? p.linkedAnnexures : o.linkedAnnexures,
        actionPlans: o.actionPlans ? plans : o.actionPlans,
      };
    }),
  };
}

/** Linking annexures to an observation from the saved report. */
export function annexureLinkedEvent(observationIndex: number, observationTitle: string, added: AtrLinkedAnnexure[], actor: string): AtrEvent {
  const ref = `OBS-${String(observationIndex + 1).padStart(2, '0')}`;
  return {
    id: newId(), ts: new Date().toISOString(), actor, role: 'Preparer', kind: 'annexure-linked',
    observationIndex, observationTitle,
    summary: added.length === 1 ? `Linked annexure “${added[0].name}” to ${ref}` : `Linked ${added.length} annexures to ${ref}`,
    detail: added.length > 1 ? added.map(a => a.name).join('\n') : undefined,
    patch: { observationIndex, observationTitle, annexures: { add: added } },
  };
}
export function annexureUnlinkedEvent(observationIndex: number, observationTitle: string, removed: AtrLinkedAnnexure, actor: string): AtrEvent {
  const ref = `OBS-${String(observationIndex + 1).padStart(2, '0')}`;
  return {
    id: newId(), ts: new Date().toISOString(), actor, role: 'Preparer', kind: 'annexure-unlinked',
    observationIndex, observationTitle,
    summary: `Unlinked annexure “${removed.name}” from ${ref}`,
    patch: { observationIndex, observationTitle, annexures: { removeId: removed.id } },
  };
}

// ─── Events from case management ───
// Derived from what changed on a case (before → after) plus its detail record,
// so every flow — single drawer, bulk review, workflow finalize — is covered by
// the one funnel that updates exception state.

export interface CaseAtrLink {
  reportId: string;
  /** Observation the cases belong to. Absent → report-level link: actions are
   *  recorded on the timeline but don't rewrite a specific observation. */
  observationIndex?: number;
  observationTitle?: string;
}

export function caseEvents(
  prev: GrcException, next: GrcException, detail: GrcCaseDetail | undefined,
  actor: string, role: 'Auditor' | 'Risk Owner', link: CaseAtrLink,
): AtrEvent[] {
  const out: AtrEvent[] = [];
  const ts = new Date().toISOString();
  const base = { actor, role, caseId: next.id, observationIndex: link.observationIndex, observationTitle: link.observationTitle };
  const target = { observationIndex: link.observationIndex, observationTitle: link.observationTitle };
  const linked = link.observationIndex != null;
  const push = (kind: AtrEventKind, summary: string, detailText?: string, patch?: AtrEventPatch) =>
    out.push({ id: newId(), ts, kind, summary, detail: detailText, patch: linked && patch ? { ...target, ...patch } : undefined, ...base });
  const lastLog = detail?.activityLog?.[0];
  const planName = detail?.actionPlans?.[0]?.name || detail?.actionTitle || next.title;
  const planText = detail?.actionPlans?.[0]?.details || detail?.actionDescription || '';
  const planDue = detail?.actionPlans?.[0]?.dueDate || detail?.actionDueDate || next.dueDate;

  // Assignment
  if ((prev.assignedTo?.name ?? '') !== (next.assignedTo?.name ?? '') && next.assignedTo) {
    push('case-assigned', `Assigned ${next.id} to ${next.assignedTo.name}`);
  }
  // Classification
  if (prev.classification !== next.classification && next.classification !== 'Unclassified') {
    const cls = next.classification;
    const actionable = ACTIONABLE_CLASSES.has(cls);
    push('case-classified', `Classified ${next.id} as ${cls}`, detail?.classificationJustification || undefined,
      actionable ? { observation: { classification: cls as AtrObservation['classification'], classificationIfEmpty: true } } : undefined);
  }
  // Action-plan lifecycle
  if (prev.actionPhase !== next.actionPhase) {
    if (next.actionPhase === 'plan-review') {
      push('plan-submitted', `Submitted a management action plan for ${next.id}`, planText || undefined,
        { plan: { caseId: next.id, set: { title: planName, text: planText || planName, dueDate: planDue, status: 'Pending' } } });
    } else if (prev.actionPhase === 'plan-review' && next.actionPhase === 'in-progress') {
      push('plan-accepted', `Accepted the action plan for ${next.id} — Risk Owner to implement`, undefined,
        { observation: { status: 'In Progress' }, plan: { caseId: next.id, set: { status: 'Pending' } } });
    } else if (prev.actionPhase === 'plan-review' && !next.actionPhase && next.actionReview === 'Rejected') {
      push('plan-rejected', `Rejected the action plan for ${next.id} — sent back for revision`, lastLog?.comment,
        { plan: { caseId: next.id, set: { verification: 'Action plan rejected by the auditor — to be revised' } } });
    } else if (next.actionPhase === 'completion-review') {
      const c = detail?.completion;
      const evidence = c?.evidence?.map(e => e.name).join(', ');
      push('action-completed', `Marked the action for ${next.id} complete${c?.selfAssessment ? ` — self-assessed ${c.selfAssessment}` : ''}${evidence ? ' · evidence attached' : ''}`,
        c?.note || undefined,
        { plan: { caseId: next.id, set: { actionTaken: c?.note || 'Action completed by the Risk Owner', ...(evidence ? { evidence } : {}) } } });
    } else if (prev.actionPhase === 'completion-review' && next.actionPhase === 'in-progress' && next.actionReview === 'Approved') {
      push('action-verified', `Verified the action for ${next.id} as Partially Implemented — remaining work continues`, lastLog?.comment,
        { plan: { caseId: next.id, set: { status: 'Partially Implemented', ...(lastLog?.comment ? { verification: lastLog.comment } : {}) } } });
    } else if (prev.actionPhase === 'completion-review' && !next.actionPhase) {
      if (next.actionReview === 'Approved') {
        const outcome: AtrActionStatus = detail?.actionStatus === 'Partially Implemented' ? 'Partially Implemented' : 'Implemented';
        push('action-verified', `Verified the action for ${next.id} as ${outcome}`, lastLog?.comment,
          { plan: { caseId: next.id, set: { status: outcome, ...(lastLog?.comment ? { verification: lastLog.comment } : {}) } } });
      } else if (next.actionReview === 'Rejected') {
        push('action-discrepancy', `Found a discrepancy in the completed action for ${next.id} — reopened`, lastLog?.comment,
          { plan: { caseId: next.id, set: { status: 'Pending', verification: lastLog?.comment || 'Discrepancy raised by the auditor — reopened' } } });
      }
    }
  }
  // Due-date revision
  const pr = prev.dueDateRevision, nr = next.dueDateRevision;
  if (nr && (!pr || pr.status !== nr.status || pr.revisedDueDate !== nr.revisedDueDate)) {
    if (nr.status === 'Pending' && (!pr || pr.status !== 'Pending' || pr.revisedDueDate !== nr.revisedDueDate)) {
      push('due-date-requested', `Requested a new due date for ${next.id}: ${nr.previousDueDate} → ${nr.revisedDueDate}`, nr.reason);
    } else if (nr.status === 'Approved' && pr?.status !== 'Approved') {
      push('due-date-approved', `Approved the revised due date for ${next.id}: ${nr.revisedDueDate}`, nr.decisionComment,
        { plan: { caseId: next.id, set: { dueDate: nr.revisedDueDate } } });
    } else if (nr.status === 'Rejected' && pr?.status !== 'Rejected') {
      push('due-date-rejected', `Kept the original due date for ${next.id} (${nr.previousDueDate})`, nr.decisionComment);
    }
  }
  // Closure (when not already implied by a verification above)
  if (prev.status !== 'Closed' && next.status === 'Closed' && !out.some(e => e.kind === 'action-verified')) {
    push('case-closed', `Closed ${next.id}`, lastLog?.comment,
      { plan: { caseId: next.id, set: { status: 'Implemented' } } });
  }
  return out;
}

// ─── Seeded demo history (curated ATRs only) ───
// The curated library ATRs ship already remediated (plans Implemented, action
// taken and evidence filled in). To make their history explorable, rewind them
// to a "just generated" baseline and lay down the case-management trail that
// would have produced today's state — the same approach atrReview.ts takes for
// the seeded version trail, and on the same cadence.

function seedDemoHistory(data: AtrReportData, seed: TimelineSeed): AtrTimeline {
  const now = Date.now();
  const generatedAt = parseStamp(seed.generatedAt, new Date(now - 14 * 86_400_000));
  const t0 = Math.min(generatedAt.getTime(), now - 14 * 86_400_000);
  const preparer = seed.preparedBy || 'You';
  const auditor = seed.auditor || preparer;
  const riskOwner = seed.riskOwner || 'Risk Owner';

  // Baseline: as generated — plans not yet actioned.
  const baseline: AtrReportData = {
    ...data,
    observations: data.observations.map(o => ({
      ...o,
      status: (o.actionPlans?.length ? 'Open' : o.status) as AtrObservationStatus | undefined,
      actionPlans: (o.actionPlans ?? []).map(p => {
        const { actionTaken: _a, evidence: _e, verification: _v, ...rest } = p;
        void _a; void _e; void _v;
        return { ...rest, status: p.status === 'Not Due' ? 'Not Due' : 'Pending' } as AtrActionPlan;
      }),
    })),
  };

  const events: AtrEvent[] = [{
    id: newId(), ts: new Date(t0).toISOString(), actor: preparer, role: 'Preparer', kind: 'generated',
    summary: 'Action Taken Report generated',
  }];
  // Spread each plan's trail across the window after generation; plans on later
  // observations start a little later so the timeline reads naturally.
  const span = now - t0 - 2 * 3_600_000;
  const plans = data.observations.flatMap((o, oi) => (o.actionPlans ?? []).map((p, pi) => ({ o, oi, p, pi })));
  plans.forEach(({ o, oi, p, pi }, n) => {
    const slot = span / (plans.length + 1);
    let t = t0 + slot * (n + 0.6);
    const step = slot / 4;
    const caseId = `EXC-${String(oi + 1).padStart(2, '0')}${String(pi + 1).padStart(2, '0')}`;
    const target = { observationIndex: oi, observationTitle: o.title };
    const at = () => { t += step; return new Date(t).toISOString(); };
    const label = p.title || p.text;
    events.push({ id: newId(), ts: at(), actor: riskOwner, role: 'Risk Owner', kind: 'plan-submitted', caseId, ...target,
      summary: `Submitted the action plan “${label.slice(0, 48)}${label.length > 48 ? '…' : ''}”`, detail: p.text !== label ? p.text : undefined,
      patch: { ...target, plan: { index: pi, set: { status: 'Pending' } } } });
    events.push({ id: newId(), ts: at(), actor: auditor, role: 'Auditor', kind: 'plan-accepted', caseId, ...target,
      summary: `Accepted the action plan — Risk Owner to implement${p.dueDate ? ` by ${p.dueDate}` : ''}`,
      patch: { ...target, observation: { status: 'In Progress' }, plan: { index: pi, set: { status: 'Pending' } } } });
    if (p.actionTaken || p.status === 'Implemented' || p.status === 'Partially Implemented') {
      events.push({ id: newId(), ts: at(), actor: riskOwner, role: 'Risk Owner', kind: 'action-completed', caseId, ...target,
        summary: `Marked the action complete${p.evidence ? ' · evidence attached' : ''}`, detail: p.actionTaken,
        patch: { ...target, plan: { index: pi, set: { actionTaken: p.actionTaken ?? 'Action completed by the Risk Owner', ...(p.evidence ? { evidence: p.evidence } : {}) } } } });
    }
    if (p.status === 'Implemented' || p.status === 'Partially Implemented') {
      events.push({ id: newId(), ts: at(), actor: auditor, role: 'Auditor', kind: 'action-verified', caseId, ...target,
        summary: `Verified the action as ${p.status}`, detail: p.verification,
        patch: { ...target, plan: { index: pi, set: { status: p.status, ...(p.verification ? { verification: p.verification } : {}) } } } });
    } else if (p.status === 'Overdue') {
      events.push({ id: newId(), ts: at(), actor: 'System', role: 'System', kind: 'due-date-requested', caseId, ...target,
        summary: `Action plan passed its due date${p.dueDate ? ` (${p.dueDate})` : ''} — marked Overdue`,
        patch: { ...target, plan: { index: pi, set: { status: 'Overdue' } } } });
    }
  });
  return { baseline, events: events.sort(byTs) };
}

// ─── Display helpers ───

export const ROLE_TONE: Record<AtrEventRole, string> = {
  'Auditor': 'bg-evidence-50 text-evidence-700',
  'Risk Owner': 'bg-brand-50 text-brand-700',
  'Preparer': 'bg-paper-100 text-ink-600',
  'System': 'bg-paper-100 text-ink-500',
};

export function fmtEventTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}
export function fmtEventDay(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}
export function fmtEventClock(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
