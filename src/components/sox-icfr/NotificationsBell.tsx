import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Bell, CheckCircle2, ClipboardList, Clock, FileText, MessageSquareWarning, Table2, XCircle,
} from 'lucide-react';
import { useIcfr } from './store';
import { conclusionOf, gradeException, isAwaitingReview, isOwnerTask, testDueInDays, testsDueNow, trackResult } from './helpers';
import { cn } from '../../lib/cn';

/**
 * The engagement's notification bell — everything pending on the person who is
 * looking at it. The auditor sees RACM rows awaiting review, open queries and
 * exceptions to assess; the risk owner sees assigned PBC / remediation tasks,
 * the auditor's remarks on their rows, and — first and unmissable — every
 * control the auditor has concluded ineffective.
 *
 * On the exception flow the bell follows the same rule as the flow itself: one
 * role per state. Whoever the exception is waiting on is the only person told
 * about it, and they are told what to DO rather than what the status is called.
 */

type Item = {
  id: string;
  kind: 'ineffective' | 'due' | 'remark' | 'task' | 'review' | 'exception';
  title: string;
  detail: string;
  onOpen: () => void;
};

const KIND_META: Record<Item['kind'], { Icon: typeof Bell; cls: string }> = {
  ineffective: { Icon: XCircle, cls: 'bg-risk-50 text-risk-700 border-risk-200' },
  due: { Icon: Clock, cls: 'bg-mitigated-50 text-mitigated-700 border-mitigated-200' },
  remark: { Icon: MessageSquareWarning, cls: 'bg-high-50 text-high-700 border-high-200' },
  task: { Icon: ClipboardList, cls: 'bg-brand-50 text-brand-700 border-brand-200' },
  review: { Icon: Table2, cls: 'bg-evidence-50 text-evidence-700 border-evidence-200' },
  exception: { Icon: FileText, cls: 'bg-high-50 text-high-700 border-high-200' },
};

export default function NotificationsBell() {
  const { eng, role, meOwner, openControl, openRegister, setTab, setView, openDeficiency } = useIcfr();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // reduced-motion: the panel's scale/translate are JS transforms, which the
  // global CSS reduced-motion rule can't reach — gate them here to opacity-only.
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const go = (controlId: string) => { setOpen(false); openControl(controlId); };
    // the exceptions page is where every step of an exception is actually worked
    // A notification names one exception, so it opens that one. The bare list is
    // still the fallback for anything that names none.
    const goExceptions = () => { setOpen(false); setView('deficiencies'); };
    const goException = (id: string) => () => { setOpen(false); openDeficiency(id); };
    // How many times this fix has already been tested and missed. A round is
    // never edited — a failure appends the next one — so this is the loop count.
    const failedRetests = (d: { retests?: { result: 'Pass' | 'Fail' }[] }) =>
      (d.retests ?? []).filter(r => r.result === 'Fail').length;

    // ── the auditor's verdicts — shown to the risk owner first, unmissable.
    //    Person-lane: only this persona's controls, tasks and rows. ───────────────
    if (role === 'risk-owner') {
      for (const c of eng.controls) {
        if (c.owner !== meOwner) continue;
        if (conclusionOf(eng, c) !== 'Ineffective') continue;
        const track = trackResult(c.design) === 'Ineffective' ? 'design' : 'operating';
        const who = (track === 'design' ? c.design.testedBy : c.operating.testedBy) ?? 'Auditor';
        out.push({
          id: `ineff-${c.id}`, kind: 'ineffective',
          title: `${c.wpRef} concluded INEFFECTIVE (${track})`,
          detail: `${c.description} — by ${who} · open to plan remediation.`,
          onOpen: () => go(c.id),
        });
      }
    }

    // ── open tasks assigned to me — due today / overdue jump the queue and land
    //    right after the verdicts; clicking goes to the control's TOD / TOE ───────
    const myTasks = eng.tasks.filter(t => t.status === 'open'
      && (role === 'risk-owner' ? isOwnerTask(eng, t, meOwner) : t.assigneeRole === role));
    const isDueNow = (t: typeof myTasks[number]) => t.overdue || /today/i.test(t.dueLabel);
    for (const t of myTasks.filter(isDueNow)) {
      out.push({
        id: `due-${t.id}`, kind: 'due',
        title: `${t.controlId} ${t.overdue ? 'is OVERDUE' : 'is due today'} · ${t.id}`,
        detail: `${t.title} — ${role === 'risk-owner' ? 'open the control to attest & evidence.' : 'open the control to complete TOD / TOE.'}`,
        onOpen: () => go(t.controlId),
      });
    }
    // ── control tests due — every control has a due date on its testing cycle.
    //    Regular testing is how the risk owner lives in the tool, so due tests
    //    are first-class notifications, not just document requests. ─────────────
    const dueTests = testsDueNow(role === 'risk-owner' ? eng.controls.filter(c => c.owner === meOwner) : eng.controls);
    for (const c of dueTests.slice(0, 5)) {
      const dd = testDueInDays(c);
      out.push({
        id: `test-${c.id}`, kind: 'due',
        title: `${c.wpRef} · control test ${dd < 0 ? `overdue ${-dd}d` : 'due today'}`,
        detail: `${c.description} — ${c.frequency.toLowerCase()} control · ${role === 'risk-owner' ? 'open to attest & evidence.' : 'open to run TOD / TOE.'}`,
        onOpen: () => go(c.id),
      });
    }
    if (dueTests.length > 5) {
      out.push({
        id: 'tests-more', kind: 'due',
        title: `${dueTests.length - 5} more control tests due`,
        detail: 'Open the Control Library "Due now" view to run the rest.',
        onOpen: () => { setOpen(false); openRegister({ view: 'due' }); },
      });
    }

    for (const t of myTasks.filter(t => !isDueNow(t))) {
      out.push({
        id: `task-${t.id}`, kind: 'task',
        title: `${t.type === 'pbc' ? 'Provide documents' : t.type === 'query' ? 'Answer query' : 'Remediate'} · ${t.id}`,
        detail: `${t.title} — ${t.dueLabel}`,
        onOpen: () => go(t.controlId),
      });
    }

    // ── the exception steps that are MINE to move ───────────────────────────────
    //    Two of the six steps belong to the owner: write the plan (③) and do the
    //    fix, then show the proof (④). The other four sit with the auditor or the
    //    reviewer, so they are not listed at all — a row you cannot act on is a
    //    row that teaches you to ignore the bell.
    if (role === 'risk-owner') {
      for (const d of eng.deficiencies) {
        if (d.status !== 'Planning' && d.status !== 'Remediation') continue;
        const c = eng.controls.find(x => x.id === d.controlId);
        // same person-lane as the tasks above — the control's owner, or the
        // person the plan itself names. Either way it is this persona's to move.
        if (c?.owner !== meOwner && d.remediation.owner !== meOwner) continue;
        const planning = d.status === 'Planning';
        out.push({
          id: `def-mine-${d.id}`, kind: 'task',
          title: planning ? `Write the plan for ${d.id}` : `Attach evidence and submit ${d.id} for retest`,
          detail: planning
            // the plan is judged against the root cause, so the owner is told it up front
            ? `${d.rootCause} — say what fixes that, who does it and by when.${d.planReview?.decision === 'Rejected' ? ' Sent back once already.' : ''}`
            : `${d.remediation.action || d.description} — “done” needs proof: attach it, then hand the fix to the auditor.`,
          onOpen: goException(d.id),
        });
      }
    }

    // ── the auditor's remarks on my rows ────────────────────────────────────────
    if (role === 'risk-owner') {
      for (const c of eng.controls) {
        if (c.owner !== meOwner || c.racmReview?.status !== 'Remark') continue;
        out.push({
          id: `rem-${c.id}`, kind: 'remark',
          title: `Auditor remark on ${c.wpRef}`,
          detail: c.racmReview.remark ?? '',
          onOpen: () => go(c.id),
        });
      }
    }

    // ── the reviewer's court, mirrored from the queue — papers, notes, closes ────
    if (role === 'reviewer') {
      // ── first, because it is a gate and not a queue: a Significant Deficiency
      //    or worse does not move until the reviewer agrees the grade. Every hour
      //    this sits here is an hour the owner cannot start planning the fix, so
      //    it outranks the papers waiting to be countersigned. The status is the
      //    gate on purpose — a grade that has since fallen still needs releasing,
      //    and re-testing the grade here would strand it.
      for (const d of eng.deficiencies.filter(x => x.status === 'Rating review')) {
        const { grade } = gradeException(d, eng);
        out.push({
          id: `rate-${d.id}`, kind: 'exception',
          title: `Confirm the ${grade} rating on ${d.id}`,
          detail: `${d.description} — nothing moves until you do: ${d.remediation.owner} cannot start planning the fix.`,
          onOpen: goException(d.id),
        });
      }
      // ── a fix that has missed twice is no longer a remediation problem. The
      //    plan is being retested against the same root cause and failing, so
      //    what needs changing is the plan, the person, or the rating — all three
      //    are the reviewer's call, not the owner's.
      for (const d of eng.deficiencies) {
        if (d.status === 'Closed') continue;   // already carries your signature
        const n = failedRetests(d);
        if (n < 2) continue;
        out.push({
          id: `loop-${d.id}`, kind: 'exception',
          title: `${d.id} · ${n} retests failed — the fix is not working`,
          detail: `${d.rootCause} — ${d.retests?.[d.retests.length - 1]?.rationale ?? 'the same root cause is still there'}. Two misses is a plan problem, not a deadline problem.`,
          onOpen: goException(d.id),
        });
      }
      const papers = eng.controls.filter(isAwaitingReview);
      if (papers.length) {
        out.push({
          id: 'rev-papers', kind: 'review',
          title: `${papers.length} paper${papers.length === 1 ? '' : 's'} awaiting your countersign`,
          detail: 'Open the reviewer queue — countersign each paper or return it with a note.',
          onOpen: () => { setOpen(false); setTab('overview'); },
        });
      }
      for (const n of eng.reviewNotes.filter(x => x.status === 'Resolved')) {
        out.push({
          id: `note-${n.id}`, kind: 'remark',
          title: `Verify resolution · ${n.controlId}`,
          detail: n.resolution?.text ?? n.text,
          onOpen: () => go(n.controlId),
        });
      }
      for (const d of eng.deficiencies.filter(x => x.status === 'Awaiting reviewer')) {
        out.push({
          id: `close-${d.id}`, kind: 'exception',
          title: `${d.id} · retest passed — yours to close`,
          detail: d.description,
          onOpen: () => { setOpen(false); setView('deficiencies'); },
        });
      }
    }

    if (role === 'auditor') {
      const pending = eng.controls.filter(c => !c.racmReview).length;
      if (pending > 0) {
        out.push({
          id: 'review-racm', kind: 'review',
          title: `${pending} RACM row${pending === 1 ? '' : 's'} awaiting your review`,
          detail: 'Approve each row or leave a remark for the risk owner.',
          onOpen: () => { setOpen(false); setTab('racm'); },
        });
      }
      // ── the plan is up and waiting on the auditor's one say in it: does it
      //    address the root cause? Named as the question rather than the status,
      //    because "Plan review" does not tell anyone what to do with it.
      for (const d of eng.deficiencies.filter(x => x.status === 'Plan review')) {
        out.push({
          id: `plan-${d.id}`, kind: 'exception',
          title: `Judge the plan on ${d.id} against its root cause`,
          detail: `${d.rootCause} — the plan says: ${d.remediation.action || 'nothing yet'}. Accept it or send it back with what it misses.`,
          onOpen: goException(d.id),
        });
      }
      // ── testing that never started. Not a finding — nothing has been shown to
      //    have failed — but it stalls silently, and at period end a control that
      //    could never be evidenced converts to an exception anyway. Chase it now.
      for (const c of eng.controls) {
        const u = c.unableToTest;
        if (!u || u.resolvedAt || u.convertedTo) continue;
        out.push({
          id: `blocked-${c.id}`, kind: 'due',
          title: `Testing blocked on ${c.wpRef} — waiting on ${c.owner}`,
          detail: `Needed: ${u.needed} — raised ${u.raisedAt}. Still open at period end and it becomes an exception.`,
          onOpen: () => go(c.id),
        });
      }
      for (const d of eng.deficiencies) {
        if (d.status === 'Closed') continue;
        if (d.status === 'Plan review') continue;   // already named above, with its question
        out.push({
          id: `def-${d.id}`, kind: 'exception',
          title: `${d.id} · ${d.status}`,
          detail: d.description,
          onOpen: () => go(d.controlId),
        });
      }
    }
    return out;
  }, [eng, role, meOwner, openControl, setTab, setView]);

  const urgent = items.filter(i => i.kind === 'ineffective').length;
  // The badge tells the truth even where the list truncates: the "+N more"
  // rollup line is one ROW but N pieces of work — count the work, not the row.
  const hiddenTests = Math.max(0, testsDueNow(role === 'risk-owner' ? eng.controls.filter(c => c.owner === meOwner) : eng.controls).length - 5);
  const pending = items.length - (hiddenTests > 0 ? 1 : 0) + hiddenTests;

  return (
    <div ref={rootRef} className="relative">
      <button onClick={() => setOpen(o => !o)} aria-label={`To-do — ${pending} pending`}
        className={cn('relative h-9 w-9 inline-flex items-center justify-center rounded-lg border transition-colors cursor-pointer',
          open ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-canvas-border text-ink-500 hover:text-ink-900 hover:border-ink-300')}>
        <Bell size={16} />
        {pending > 0 && (
          <span className={cn('absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white inline-flex items-center justify-center tabular-nums',
            urgent > 0 ? 'bg-risk-600' : 'bg-brand-600')}>
            {pending}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }} animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }} exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }} transition={{ duration: 0.14 }}
            className="absolute right-0 top-[calc(100%+8px)] z-50 w-[400px] rounded-2xl border border-canvas-border bg-canvas-elevated shadow-[0_20px_50px_-18px_rgba(15,8,30,0.45)] overflow-hidden">
            <div className="px-4 py-3 border-b border-canvas-border flex items-center justify-between">
              <div>
                <div className="text-[13px] font-semibold text-ink-900">To-do</div>
                <div className="text-[11px] text-ink-500 mt-0.5">Pending assignment &amp; review · viewing as {role === 'auditor' ? 'Auditor' : role === 'reviewer' ? 'Reviewer' : 'Risk Owner'}</div>
              </div>
              {urgent > 0 && <span className="text-[10.5px] font-bold text-risk-700 bg-risk-50 border border-risk-200 rounded-full px-2 h-5 inline-flex items-center">{urgent} ineffective</span>}
            </div>
            <div className="max-h-[420px] overflow-y-auto p-2">
              {items.map(it => {
                const meta = KIND_META[it.kind];
                return (
                  <button key={it.id} onClick={it.onOpen}
                    className="w-full flex items-start gap-2.5 rounded-xl p-2.5 text-left hover:bg-paper-50 transition-colors cursor-pointer">
                    <span className={cn('w-7 h-7 rounded-lg border inline-flex items-center justify-center shrink-0', meta.cls)}><meta.Icon size={14} /></span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-[12px] font-semibold leading-snug', it.kind === 'ineffective' ? 'text-risk-700' : 'text-ink-900')}>{it.title}</span>
                      <span className="block text-[11px] text-ink-600 mt-0.5 line-clamp-2">{it.detail}</span>
                    </span>
                  </button>
                );
              })}
              {items.length === 0 && (
                <div className="py-10 text-center text-[12px] text-ink-400">
                  <CheckCircle2 size={18} className="mx-auto mb-2 text-compliant-500" /> Nothing pending — all caught up.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
