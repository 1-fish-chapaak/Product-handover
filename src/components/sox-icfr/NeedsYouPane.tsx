/**
 * ── Needs you — the rail's first tab ──────────────────────────────────────────
 * The rail used to open on a conversation, which made the reader ask Ira what
 * was left instead of being told (agentic UI review #6, 30 Sep). Its tabs are
 * now Needs you / Ask / Activity, and it opens HERE: one flat card per thing
 * that is waiting on this person, in the order they would want to clear them,
 * each with two buttons at most.
 *
 * "Ira couldn't test" is one card, not a row marker and a separate chase (#7):
 * the reason and the request to the owner, already drafted, side by side — so
 * the one press that unblocks the check is on the card that explains it.
 *
 * Nothing here decides anything. Every card either sends what the page would
 * send (remindOwnerForFiles), opens the working in the rail, or scrolls the
 * real row into view on the left. The judgement stays on the page.
 *
 * TDZ note: this folder has an import cycle. Nothing here reads another
 * sox-icfr export at module load — only inside functions — and it never
 * imports ControlDossier (which renders this).
 */
import { useMemo, type ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useIcfr } from './store';
import { InlineNote, useInlineNote } from './InlineNote';
import { useAuditLog } from '../../context/AdminDataContext';
import { iraStateOfPoint, iraStateOfStep } from './IraState';
import {
  CONFIDENT_AT, confidenceOf, controlCode, couldntAskFor, dayMonth, designApproved, designOutstandingRequired, discussionsFor, iraCannotTest,
  isControlLockedIn, isEngagementLocked, isOwnerTask, operatingApplies, overridePatterns, samePerson, trackResult, pointResult, requiredFilesOf, rollPendingParts, ROLL_PART_ANCHOR, ROLL_PART_LABEL, stepResult, unconfirmedIra,
  type OverridePattern,
} from './helpers';
import { ownersOf } from './auditScope';
import { pointEvidence, useOpenRailDetail, verdictCite } from './RailDetail';
import type { Control, DesignPoint, HandoffTask, IcfrEngagement, OperatingStep, Role } from './types';

export type NeedsItem =
  | { kind: 'roll'; id: string; from: string; labels: string[]; anchor: string }
  | { kind: 'ipe'; id: string; report: string; done: number; total: number; unreliable: boolean; anchor: string }
  | { kind: 'lock'; id: string; anchor: string }
  | { kind: 'docs'; id: string; names: string[]; anchor: string }
  | { kind: 'couldnt'; id: string; text: string; anchor: string; reason: string; what: string; request: string; owner: string; checkId: string; track: 'design' | 'operating'; title: string }
  | { kind: 'unsure'; id: string; track: 'design' | 'operating'; text: string; confidence: number; anchor: string; point?: DesignPoint; step?: OperatingStep; confKey: string }
  | { kind: 'stale'; id: string; step: OperatingStep; anchor: string }
  | { kind: 'conclude'; id: string; track: 'design' | 'operating'; anchor: string }
  | { kind: 'reply'; id: string; by: string; text: string }
  | { kind: 'learned'; id: string; pattern: OverridePattern }
  // The reviewer's own cards (5 Oct) — the page's two decisions, with its guards.
  | { kind: 'approve'; id: string; result: string; preparedBy: string; anchor: string }
  | { kind: 'countersign'; id: string; preparedBy: string; anchor: string }
  | { kind: 'note'; id: string; by: string; answer: string; text: string; anchor: string }
  // The risk owner's — what audit asked of them on this control.
  | { kind: 'task'; id: string; task: HandoffTask; defId?: string; anchors: string[] };

const stepLabel = (s: OperatingStep) => `${s.code} ${s.description}`.trim();

/**
 * What is waiting on this person, in the order they should clear it. Pure, so
 * the rail's tab can print the same count the pane shows.
 *
 * The testing cards (1–4) follow the page's own canTest: auditor, and the
 * control not concluded. The reviewer gets the design approval and the
 * countersign when the page would let them do either, and the review-note
 * answers waiting on them; the risk owner gets the requests audit sent them
 * on this control (5 Oct). Everyone gets the discussions waiting on them.
 * `me` is the viewer's own name, for the four-eyes and ownership checks.
 */
export function needsYouItems(control: Control, eng: IcfrEngagement, role: Role, auditId?: string | null, me?: string): NeedsItem[] {
  const out: NeedsItem[] = [];
  const canTest = role === 'auditor' && !isControlLockedIn(eng, control);
  const opApplies = operatingApplies(eng, control);
  const designDone = control.design.conclusion !== 'Not tested';
  const opDone = control.operating.conclusion !== 'Not tested';

  if (canTest) {
    // ⓪ Last round's set-up, waiting to be confirmed or edited (#13). It holds
    // its steps, so it comes before everything those steps would produce.
    const pendingRoll = rollPendingParts(control);
    if (pendingRoll.length && control.rollForward) {
      out.push({
        kind: 'roll', id: 'roll', from: control.rollForward.from, anchor: ROLL_PART_ANCHOR[pendingRoll[0]],
        labels: pendingRoll.map(p => ROLL_PART_LABEL[p]),
      });
    }

    // ⓪ The population's report, and then the lock (agentic UX #10, 1 Oct).
    // IPE lives only in step ① — the card points there, it does not test.
    // Upstream of everything else here, so it comes first.
    const pop = control.operating.population;
    // Both wait on the reviewer's design approval, as the store does — the
    // population's IPE and lock are refused before it (product owner, 1 Oct).
    if (opApplies && pop && !pop.locked && designApproved(control)) {
      const ipe = control.operating.ipe;
      if (ipe?.conclusion !== 'Reliable') {
        const checks = ipe?.checks ?? [];
        out.push({
          kind: 'ipe', id: 'ipe', anchor: 'ipe-test',
          report: ipe?.reportName ?? pop.sourceFile ?? 'the source report',
          done: checks.filter(k => k.result !== 'Not tested').length, total: checks.length,
          unreliable: ipe?.conclusion === 'Not reliable',
        });
      } else {
        out.push({ kind: 'lock', id: 'lock', anchor: 'lock-population' });
      }
    }

    // ① Checks Ira could not test — the reason, and the ask already written.
    const owner = ownersOf(control).processOwner;
    const outstanding = designOutstandingRequired(control);
    for (const p of control.design.points) {
      if (iraStateOfPoint(p, designDone) !== 'couldnt') continue;
      const block = iraCannotTest(p, control);
      const doc = block
        ? (outstanding.find(d => d.kind === block.needs) ?? control.design.documents.find(d => d.kind === block.needs))
        : outstanding[0];
      // Named as the document is named, for the task title; lower-cased in the ask.
      const named = doc ? (doc.kind === 'Custom' ? doc.name : doc.kind) : block ? block.needs : 'supporting evidence';
      const what = doc?.kind === 'Custom' ? named : named.toLowerCase();
      out.push({
        kind: 'couldnt', id: `couldnt:${p.id}`, text: p.text, anchor: `dp-${p.id}`, owner, what,
        checkId: p.id, track: 'design', title: `Share the ${named} — ${controlCode(control)}`,
        reason: block?.reason ?? p.validation?.blocked ?? 'Nothing on file answers this check.',
        request: `Please send the ${what} for ${controlCode(control)} — needed to test “${p.text}”.`,
      });
    }

    // ①a A required design element not on file (click-through, 5 Oct). Ira asks
    // for it in the chat and the page refuses to run or conclude without it, so
    // "Nothing needs you" beside that was the rail contradicting both. Skipped
    // when an "Ira couldn't test" card above already names what is missing.
    if (!designDone && outstanding.length > 0 && !out.some(it => it.kind === 'couldnt' && it.track === 'design')) {
      out.push({
        kind: 'docs', id: 'docs', anchor: `doc-${outstanding[0].id}`,
        names: outstanding.map(d => (d.kind === 'Custom' ? d.name : d.kind)),
      });
    }

    // ①b TOE attributes Ira refused for having no file to quote (agentic UX #5,
    // 1 Oct: no citation, no verdict) — same card, the files named in the ask.
    if (operatingApplies(eng, control)) {
      for (const st of control.operating.steps) {
        if (iraStateOfStep(st, control.operating.conclusion !== 'Not tested') !== 'couldnt') continue;
        const missing = requiredFilesOf(st, control).filter(f => !f.file).map(f => f.label.toLowerCase());
        const what = missing.length ? missing.join(', ') : 'the files this attribute reads';
        out.push({
          kind: 'couldnt', id: `couldnt:${st.id}`, text: `${st.code} · ${st.description}`, anchor: `step-${st.id}`, owner, what,
          checkId: st.id, track: 'operating', title: `Upload ${what} — ${controlCode(control)} ${st.code}`,
          reason: st.validation?.blocked ?? 'No file is behind this attribute.',
          request: `Please upload ${what} for ${controlCode(control)} — needed to test ${st.code}.`,
        });
      }
    }

    // ② Results Ira holds loosely that nobody has concluded yet.
    for (const p of control.design.points) {
      if (iraStateOfPoint(p, designDone) !== 'review') continue;
      const confKey = `${control.id}:${p.id}`;
      const c = confidenceOf(p.validation, confKey);
      if (c == null || c >= CONFIDENT_AT) continue;
      out.push({ kind: 'unsure', id: `unsure:${p.id}`, track: 'design', text: p.text, confidence: c, anchor: `dp-${p.id}`, point: p, confKey });
    }
    if (opApplies) {
      for (const s of control.operating.steps) {
        if (iraStateOfStep(s, opDone) !== 'review') continue;
        const confKey = `${control.id}:${s.id}`;
        const c = confidenceOf(s.validation, confKey);
        if (c == null || c >= CONFIDENT_AT) continue;
        out.push({ kind: 'unsure', id: `unsure:${s.id}`, track: 'operating', text: stepLabel(s), confidence: c, anchor: `step-${s.id}`, step: s, confKey });
      }
      // ③ Runs the sample has moved out from under.
      for (const s of control.operating.steps) {
        if (s.staleRun) out.push({ kind: 'stale', id: `stale:${s.id}`, step: s, anchor: `step-${s.id}` });
      }
    }

    // ④ A track with every result in and no conclusion. A stale run blocks the
    // operating conclusion in the store, so it blocks the card too — ③ says why.
    const pts = control.design.points;
    // A required design element still missing holds the conclusion too, so the
    // card waits for it — offering "ready" the page would then refuse misleads.
    if (!designDone && pts.length > 0 && pts.every(p => pointResult(p) !== 'Not tested') && designOutstandingRequired(control).length === 0 && unconfirmedIra(control, 'design').length === 0) {
      out.push({ kind: 'conclude', id: 'conclude:design', track: 'design', anchor: 'conclude-design' });
    }
    const steps = control.operating.steps;
    if (opApplies && !opDone && steps.length > 0 && steps.every(s => stepResult(s) !== 'Not tested') && !steps.some(s => s.staleRun) && unconfirmedIra(control, 'operating').length === 0) {
      out.push({ kind: 'conclude', id: 'conclude:operating', track: 'operating', anchor: 'conclude-operating' });
    }
  }

  // ⑥ "Ira learned" (agentic UX #9) — the reviewer rules on a pattern in the
  // auditors' overrides, on any control the pattern stands on.
  if (role === 'reviewer' && me) {
    const sealed = isEngagementLocked(eng);
    const so = control.wpSignoff;
    // Approve the design — the guards DesignApprovalBlock and approveDesign use:
    // concluded, not yet approved, paper not countersigned, and never your own.
    const result = trackResult(control.design);
    const approval = control.design.approval;
    const preparedBy = approval?.preparedBy ?? (control.design.testedBy ? { by: control.design.testedBy, at: control.design.testedAt ?? '' } : undefined);
    if (!sealed && result !== 'Not tested' && !approval?.approvedBy && !so?.reviewer && !samePerson(preparedBy, me)) {
      out.push({ kind: 'approve', id: 'approve', result, preparedBy: preparedBy?.by ?? eng.preparer, anchor: 'design-approval' });
    }
    // Countersign — SignOffSection's canCounter: signed by the preparer, every
    // review note closed, not your own paper, the design approved.
    const notesOpen = eng.reviewNotes.some(n => n.controlId === control.id && n.status !== 'Closed');
    if (!sealed && so?.preparer && !so.reviewer && !notesOpen && so.preparer.by !== me && designApproved(control)) {
      out.push({ kind: 'countersign', id: 'countersign', preparedBy: so.preparer.by, anchor: 'wp-signoff' });
    }
    // Review notes the auditor has answered — closing or reopening is yours.
    for (const n of eng.reviewNotes) {
      if (n.controlId !== control.id || n.status !== 'Resolved' || !n.resolution) continue;
      out.push({ kind: 'note', id: `note:${n.id}`, by: n.resolution.by, answer: n.resolution.text, text: n.text, anchor: `rn-${n.id}` });
    }
  }

  // The risk owner's requests on this control — the same rows their task list
  // shows, by the same rule: a remediation only while the exception is at one
  // of the two steps that are theirs (Planning, Remediation).
  if (role === 'risk-owner' && me) {
    const tasks = eng.tasks
      .filter(t => t.controlId === control.id && t.status === 'open' && isOwnerTask(eng, t, me))
      .sort((a, b) => Number(b.overdue) - Number(a.overdue));
    for (const t of tasks) {
      const def = t.type === 'remediation'
        ? eng.deficiencies.find(d => d.controlId === t.controlId && (d.status === 'Planning' || d.status === 'Remediation'))
        : undefined;
      if (t.type === 'remediation' && !def) continue;
      const anchors = [
        ...(def ? ['control-exception'] : []),
        ...(t.checkId ? [`dp-${t.checkId}`] : []),
        t.focus === 'population' ? 'vstep-population' : 'vstep-design',
      ];
      out.push({ kind: 'task', id: `task:${t.id}`, task: t, defId: def?.id, anchors });
    }
  }

  if (role === 'reviewer') {
    for (const p of overridePatterns(eng, auditId)) {
      if (p.controls.includes(control.id)) out.push({ kind: 'learned', id: `learned:${p.key}`, pattern: p });
    }
  }

  // ⑤ Discussions whose last word was somebody else's.
  for (const d of discussionsFor(eng, control.id)) {
    if (d.resolved) continue;
    const last = d.comments[d.comments.length - 1];
    if (!last || last.role === role) continue;
    out.push({ kind: 'reply', id: `reply:${d.id}`, by: last.by, text: last.text });
  }
  return out;
}

const showMe = (id: string) => document.getElementById(id)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
/** The first of several places that is on the page — an owner's page shows
 *  fewer steps than the auditor's, so a task falls back to its step. */
const showFirst = (ids: string[]) => { const el = ids.map(i => document.getElementById(i)).find(Boolean); el?.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
const TASK_EYEBROW: Record<HandoffTask['type'], string> = { pbc: 'Asked of you', query: 'Question for you', remediation: 'Your fix' };

const BTN = 'inline-flex items-center h-7 px-2.5 rounded-md text-[0.75rem] font-semibold transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30';
const PRIMARY = cn(BTN, 'bg-primary text-white hover:bg-brand-700');
const QUIET = cn(BTN, 'border border-canvas-border bg-canvas-elevated text-ink-700 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200');

function Card({ eyebrow, ira = false, children, actions }: { eyebrow: string; ira?: boolean; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="border border-canvas-border rounded-xl bg-canvas-elevated p-3">
      <div className="flex items-center gap-1 mb-1 text-[0.6875rem] font-semibold text-ink-500">
        {ira && <Sparkles size={11} className="text-brand-500 shrink-0" aria-hidden />}
        {eyebrow}
      </div>
      {children}
      {actions && <div className="mt-2.5 flex flex-wrap items-center gap-1.5">{actions}</div>}
    </div>
  );
}

export default function NeedsYouPane({ control, onGoComments }: { control: Control; onGoComments: () => void }) {
  const { eng, role, me, openAuditId, remindOwnerForFiles, decideLearned, approveDesign, signOffControlWp, submitTask, openDeficiency } = useIcfr();
  const openDetail = useOpenRailDetail();
  const logEvent = useAuditLog();
  // A sent request takes its card with it, so what happened is said here.
  const sent = useInlineNote();
  const items = useMemo(() => needsYouItems(control, eng, role, openAuditId, me), [control, eng, role, openAuditId, me]);
  // Whether a drafted request already went out is read off the owner's task
  // list (couldntAskFor), so "Sent to …" survives a reload or a new visit.

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
      <InlineNote note={sent.note} className="px-1" />
      {items.length === 0 && (
        <p className="px-1 py-2 text-[0.75rem] text-ink-500">Nothing needs you on this control.</p>
      )}
      {items.map(it => {
        switch (it.kind) {
          case 'roll':
            return (
              <Card key={it.id} eyebrow="From last round"
                actions={<button type="button" className={PRIMARY} onClick={() => showMe(it.anchor)}>Go to it</button>}>
                <p className="text-[0.8125rem] leading-snug text-ink-800">{it.labels.join(', ')} came over from the {it.from}.</p>
                <p className="mt-1 text-[0.75rem] leading-snug text-ink-500">Confirm each unchanged or edit it — its step waits until you do.</p>
              </Card>
            );
          case 'ipe':
            return (
              <Card key={it.id} eyebrow="IPE test"
                actions={<button type="button" className={it.unreliable ? QUIET : PRIMARY} onClick={() => showMe(it.anchor)}>Go to IPE test</button>}>
                <p className="text-[0.8125rem] leading-snug text-ink-800">{it.report}</p>
                <p className={cn('mt-1 text-[0.75rem] leading-snug', it.unreliable ? 'text-risk-700' : 'text-ink-500')}>
                  {it.unreliable
                    ? 'Concluded not reliable — the population can’t be locked off it. Ask for a new extract, or withdraw and re-test.'
                    : it.total > 0 && it.done === it.total
                      ? 'All checks answered — conclude the report to unlock the population.'
                      : `${it.done} of ${it.total || 4} checks done — the population locks once the report is reliable.`}
                </p>
              </Card>
            );
          case 'lock':
            return (
              <Card key={it.id} eyebrow="Population"
                actions={<button type="button" className={PRIMARY} onClick={() => showMe(it.anchor)}>Go to lock</button>}>
                <p className="text-[0.8125rem] leading-snug text-ink-800">The report is reliable. Lock the population so the sample can be drawn.</p>
              </Card>
            );
          case 'docs':
            return (
              <Card key={it.id} eyebrow="Test of design"
                actions={<button type="button" className={QUIET} onClick={() => showMe(it.anchor)}>Show me</button>}>
                <p className="text-[0.8125rem] leading-snug text-ink-800">
                  {it.names.length === 1 ? it.names[0] : `${it.names.slice(0, -1).join(', ')} and ${it.names[it.names.length - 1]}`} {it.names.length === 1 ? 'is' : 'are'} not on file yet.
                </p>
                <p className="mt-1 text-[0.75rem] leading-snug text-ink-500">Required before the design checks can run. Attach it, or mark it not applicable with a reason.</p>
              </Card>
            );
          case 'couldnt': {
            const first = it.owner.split(/\s+/)[0] || it.owner;
            const asked = couldntAskFor(eng, control.id, it.checkId);
            return (
              <Card key={it.id} ira eyebrow="Ira couldn’t test">
                <p className="text-[0.8125rem] leading-snug text-ink-800">{it.text}</p>
                <p className="mt-1 text-[0.75rem] leading-snug text-high-700">{it.reason}</p>
                <blockquote className="mt-2 pl-2.5 border-l-2 border-canvas-border text-[0.75rem] leading-snug text-ink-600 italic">
                  {it.request}
                </blockquote>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {asked
                    ? <span className="text-[0.75rem] font-semibold text-ink-500">Sent to {first}{asked.dueAt ? ` · due ${dayMonth(asked.dueAt)}` : ''}</span>
                    : (
                      <button type="button" className={PRIMARY}
                        onClick={() => remindOwnerForFiles(control.id, it.request, { title: it.title, checkId: it.checkId, track: it.track })}>
                        Send to {first}
                      </button>
                    )}
                  <button type="button" className={QUIET} onClick={() => showMe(it.anchor)}>Show me</button>
                </div>
              </Card>
            );
          }
          case 'unsure': {
            const validation = it.point?.validation ?? it.step?.validation;
            return (
              <Card key={it.id} ira eyebrow={`Ira is less sure · ${it.confidence}%`}
                actions={<>
                  {validation && (
                    <button type="button" className={PRIMARY}
                      onClick={() => openDetail({ kind: 'working', title: it.text, validation, control, step: it.step, confKey: it.confKey,
                        // a card about one design check opens on its passage, in the file its row opens
                        ...(it.point ? { evidence: pointEvidence(control, it.point), focusCite: verdictCite(it.point.validation) } : {}) })}>
                      See the working
                    </button>
                  )}
                  <button type="button" className={QUIET} onClick={() => showMe(it.anchor)}>Show me</button>
                </>}>
                <p className="text-[0.8125rem] leading-snug text-ink-800">{it.text}</p>
              </Card>
            );
          }
          case 'stale':
            return (
              <Card key={it.id} eyebrow="Re-run needed"
                actions={<button type="button" className={QUIET} onClick={() => showMe(it.anchor)}>Show me</button>}>
                <p className="text-[0.8125rem] leading-snug text-ink-800">{stepLabel(it.step)}</p>
                <p className="mt-1 text-[0.75rem] leading-snug text-ink-500">The sample changed since Ira ran.</p>
              </Card>
            );
          case 'conclude':
            return (
              <Card key={it.id} eyebrow={it.track === 'design' ? 'Test of design' : 'Test of effectiveness'}
                actions={<button type="button" className={PRIMARY} onClick={() => showMe(it.anchor)}>Go to Conclude</button>}>
                <p className="text-[0.8125rem] leading-snug text-ink-800">
                  {it.track === 'design' ? 'TOD' : 'TOE'} is ready to conclude — every {it.track === 'design' ? 'check' : 'attribute'} has a result.
                </p>
              </Card>
            );
          case 'learned': {
            const p = it.pattern;
            const thing = p.which === 'design' ? 'design check' : 'attribute';
            const reasons = Array.from(new Set(p.reasons)).slice(0, 3);
            return (
              <Card key={it.id} ira eyebrow="Ira learned · needs your approval"
                actions={<>
                  <button type="button" className={PRIMARY} onClick={() => decideLearned(control.id, p, true)}>Approve</button>
                  <button type="button" className={QUIET} onClick={() => decideLearned(control.id, p, false)}>Reject</button>
                </>}>
                <p className="text-[0.8125rem] leading-snug text-ink-800">{p.text}</p>
                <p className="mt-1 text-[0.75rem] leading-snug text-ink-600">
                  Auditors changed Ira’s {p.from} to {p.to} on this {thing} on {p.controls.length} controls.
                </p>
                {reasons.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 pl-2.5 border-l-2 border-canvas-border text-[0.75rem] leading-snug text-ink-500 italic">
                    {reasons.map(r => <li key={r}>{r}</li>)}
                  </ul>
                )}
                <p className="mt-1.5 text-[0.75rem] leading-snug text-ink-500">
                  Approve and Ira answers {p.to} here from its next run — the auditor still confirms it.
                </p>
              </Card>
            );
          }
          case 'approve':
            return (
              <Card key={it.id} eyebrow="Design approval"
                actions={<>
                  <button type="button" className={PRIMARY}
                    onClick={() => { approveDesign(control.id); logEvent({ action: 'Update', description: `Approved TOD for ${control.id}`, module: 'SOX ICFR', entity: 'Control' }); }}>
                    Approve
                  </button>
                  <button type="button" className={QUIET} onClick={() => showMe(it.anchor)}>Show me</button>
                </>}>
                <p className="text-[0.8125rem] leading-snug text-ink-800">{it.preparedBy} concluded TOD {it.result.toLowerCase()}.</p>
                <p className="mt-1 text-[0.75rem] leading-snug text-ink-500">Approve it, or return it from the page with a note.</p>
              </Card>
            );
          case 'countersign':
            return (
              <Card key={it.id} eyebrow="Final"
                actions={<>
                  <button type="button" className={PRIMARY}
                    onClick={() => { signOffControlWp(control.id, 'reviewer'); logEvent({ action: 'Update', description: `Countersigned the working paper for ${control.id}`, module: 'SOX ICFR', entity: 'Control' }); }}>
                    Countersign
                  </button>
                  <button type="button" className={QUIET} onClick={() => showMe(it.anchor)}>Show me</button>
                </>}>
                <p className="text-[0.8125rem] leading-snug text-ink-800">{it.preparedBy} signed the working paper. It is ready for your countersign.</p>
              </Card>
            );
          case 'note':
            return (
              <Card key={it.id} eyebrow={`${it.by} answered your review note`}
                actions={<button type="button" className={PRIMARY} onClick={() => showMe(it.anchor)}>Show me</button>}>
                <p className="text-[0.8125rem] leading-snug text-ink-800 line-clamp-2">{it.answer}</p>
                <p className="mt-1 text-[0.75rem] leading-snug text-ink-500 line-clamp-1">{it.text}</p>
              </Card>
            );
          case 'task': {
            const t = it.task;
            const due = t.dueLabel && t.dueLabel !== 'Open' ? t.dueLabel.charAt(0).toLowerCase() + t.dueLabel.slice(1) : '';
            const act = t.type === 'remediation'
              ? <button type="button" className={PRIMARY} onClick={() => it.defId && openDeficiency(it.defId)}>Open</button>
              : <button type="button" className={PRIMARY} onClick={() => { submitTask(t.id); sent.show('info', `“${t.title}” sent to the audit team.`); }}>{t.type === 'pbc' ? 'Upload' : 'Respond'}</button>;
            return (
              <Card key={it.id} eyebrow={TASK_EYEBROW[t.type]}
                actions={<>{act}<button type="button" className={QUIET} onClick={() => showFirst(it.anchors)}>Show me</button></>}>
                <p className="text-[0.8125rem] leading-snug text-ink-800">
                  {t.title}{due && <span className={t.overdue ? 'text-risk-700' : 'text-ink-500'}> · {due}</span>}
                </p>
                {t.detail && <p className="mt-1 text-[0.75rem] leading-snug text-ink-500 line-clamp-2">{t.detail}</p>}
              </Card>
            );
          }
          case 'reply':
            return (
              <Card key={it.id} eyebrow={`${it.by} is waiting on a reply`}
                actions={<button type="button" className={PRIMARY} onClick={onGoComments}>Reply</button>}>
                <p className="text-[0.8125rem] leading-snug text-ink-700 line-clamp-2">{it.text}</p>
              </Card>
            );
        }
      })}
    </div>
  );
}
