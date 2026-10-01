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
import { useMemo, useState, type ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useIcfr } from './store';
import { iraStateOfPoint, iraStateOfStep } from './IraState';
import {
  CONFIDENT_AT, confidenceOf, controlCode, designApproved, designOutstandingRequired, discussionsFor, iraCannotTest,
  isControlLockedIn, operatingApplies, overridePatterns, pointResult, requiredFilesOf, rollPendingParts, ROLL_PART_ANCHOR, ROLL_PART_LABEL, stepResult, unconfirmedIra,
  type OverridePattern,
} from './helpers';
import { ownersOf } from './auditScope';
import { useOpenRailDetail } from './RailDetail';
import type { Control, DesignPoint, IcfrEngagement, OperatingStep, Role } from './types';

export type NeedsItem =
  | { kind: 'roll'; id: string; from: string; labels: string[]; anchor: string }
  | { kind: 'ipe'; id: string; report: string; done: number; total: number; unreliable: boolean; anchor: string }
  | { kind: 'lock'; id: string; anchor: string }
  | { kind: 'couldnt'; id: string; text: string; anchor: string; reason: string; what: string; request: string; owner: string }
  | { kind: 'unsure'; id: string; track: 'design' | 'operating'; text: string; confidence: number; anchor: string; point?: DesignPoint; step?: OperatingStep; confKey: string }
  | { kind: 'stale'; id: string; step: OperatingStep; anchor: string }
  | { kind: 'conclude'; id: string; track: 'design' | 'operating'; anchor: string }
  | { kind: 'reply'; id: string; by: string; text: string }
  | { kind: 'learned'; id: string; pattern: OverridePattern };

const stepLabel = (s: OperatingStep) => `${s.code} ${s.description}`.trim();

/**
 * What is waiting on this person, in the order they should clear it. Pure, so
 * the rail's tab can print the same count the pane shows.
 *
 * The testing cards (1–4) follow the page's own canTest: auditor, and the
 * control not concluded. Everyone else — the risk owner and the reviewer —
 * gets only the discussions waiting on them, which is the one thing on this
 * control they are asked to do from here.
 */
export function needsYouItems(control: Control, eng: IcfrEngagement, role: Role, auditId?: string | null): NeedsItem[] {
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
    if (opApplies && pop && !pop.locked) {
      const ipe = control.operating.ipe;
      if (ipe?.conclusion !== 'Reliable') {
        const checks = ipe?.checks ?? [];
        out.push({
          kind: 'ipe', id: 'ipe', anchor: 'ipe-test',
          report: ipe?.reportName ?? pop.sourceFile ?? 'the source report',
          done: checks.filter(k => k.result !== 'Not tested').length, total: checks.length,
          unreliable: ipe?.conclusion === 'Not reliable',
        });
      } else if (designApproved(control)) {
        // The store refuses the lock before design is approved, so the card
        // waits for that too rather than offering a button that does nothing.
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
      const what = doc ? (doc.kind === 'Custom' ? doc.name : doc.kind.toLowerCase())
        : block ? block.needs.toLowerCase() : 'supporting evidence';
      out.push({
        kind: 'couldnt', id: `couldnt:${p.id}`, text: p.text, anchor: `dp-${p.id}`, owner, what,
        reason: block?.reason ?? p.validation?.blocked ?? 'Nothing on file answers this check.',
        request: `Please send the ${what} for ${controlCode(control)} — needed to test “${p.text}”.`,
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
  const { eng, role, openAuditId, remindOwnerForFiles, decideLearned } = useIcfr();
  const openDetail = useOpenRailDetail();
  const items = useMemo(() => needsYouItems(control, eng, role, openAuditId), [control, eng, role, openAuditId]);
  // Which drafted requests went out from here. Local on purpose: the request
  // itself lands on the owner's task list, and this only stops the same card
  // offering to send it twice in one sitting.
  const [sent, setSent] = useState<Set<string>>(() => new Set());

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
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
          case 'couldnt': {
            const first = it.owner.split(/\s+/)[0] || it.owner;
            const done = sent.has(it.id);
            return (
              <Card key={it.id} ira eyebrow="Ira couldn’t test">
                <p className="text-[0.8125rem] leading-snug text-ink-800">{it.text}</p>
                <p className="mt-1 text-[0.75rem] leading-snug text-high-700">{it.reason}</p>
                <blockquote className="mt-2 pl-2.5 border-l-2 border-canvas-border text-[0.75rem] leading-snug text-ink-600 italic">
                  {it.request}
                </blockquote>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {done
                    ? <span className="text-[0.75rem] font-semibold text-ink-500">Sent to {first}</span>
                    : (
                      <button type="button" className={PRIMARY}
                        onClick={() => { remindOwnerForFiles(control.id, it.request); setSent(s => new Set(s).add(it.id)); }}>
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
                      onClick={() => openDetail({ kind: 'working', title: it.text, validation, control, step: it.step, confKey: it.confKey })}>
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
