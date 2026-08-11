import { Upload, CheckCircle2, MessageSquare, Circle, ChevronRight, FileWarning, Inbox, ListChecks, PenLine } from 'lucide-react';
import { useToast } from '../shared/Toast';
import { useIcfr } from './store';
import { isOwnerTask, testDueInDays, testDueLabel, testsDueNow } from './helpers';
import { isOwnerOf } from './auditScope';
import { cn } from '../../lib/cn';
import type { Deficiency, ExceptionStatus, HandoffTask, TaskType } from './types';

const TASK_META: Record<TaskType, { label: string; Icon: typeof Upload; action: string }> = {
  pbc: { label: 'document request', Icon: Upload, action: 'Provide documents' },
  remediation: { label: 'remediation', Icon: FileWarning, action: 'Submit fix' },
  query: { label: 'question', Icon: MessageSquare, action: 'Respond' },
};

export default function RiskOwnerPortal() {
  const { eng, meOwner, submitTask, openControl, openRegister, setTab, setView, setExceptionStatus } = useIcfr();
  const { addToast } = useToast();
  // person-lane: only this persona's tasks and controls — never the whole engagement
  const mine = eng.tasks.filter(t => isOwnerTask(eng, t, meOwner));
  const dueNow = (t: HandoffTask) => t.overdue || /today/i.test(t.dueLabel);

  // The exception flow is six steps and only two of them are the owner's: ③ write
  // the plan, ④ do the fix and show the proof. Everything else — sizing, the
  // rating confirmation, the auditor's read of the plan, the retest, the close —
  // sits in someone else's court, and a reminder for work you cannot do is worse
  // than no reminder. So a remediation row appears while the exception is at one
  // of those two states, and disappears while it is away.
  const OWNER_STATES: ExceptionStatus[] = ['Planning', 'Remediation'];
  const exceptionFor = (t: HandoffTask): Deficiency | undefined =>
    eng.deficiencies.find(d => d.controlId === t.controlId && OWNER_STATES.includes(d.status));
  const inMyCourt = (t: HandoffTask) => t.type !== 'remediation' || !!exceptionFor(t);
  // The two steps ask for different things, so the row's call to action says
  // which one it is: at ③ there is nothing to submit yet — the plan has to be
  // written first, and only ④ ends in "submit for retest".
  const remediationCta = (t: HandoffTask): { label: string; Icon: typeof Upload } => {
    const def = exceptionFor(t);
    return def?.status === 'Planning'
      ? { label: 'Write the plan', Icon: PenLine }
      : { label: TASK_META.remediation.action, Icon: TASK_META.remediation.Icon };
  };

  // due-today / overdue tasks lead the inbox
  const open = mine.filter(t => t.status === 'open' && inMyCourt(t)).sort((a, b) => Number(dueNow(b)) - Number(dueNow(a)));
  const submitted = mine.filter(t => t.status !== 'open');

  const act = (t: HandoffTask) => {
    // a remediation "done" goes through the same gate as the exceptions page:
    // proof first, then the submit — never a reminder cleared on its own
    if (t.type === 'remediation') {
      const def = exceptionFor(t);
      if (def) {
        // ③ nothing to submit yet — the plan is what the auditor judges against
        // the root cause, so this points at writing it rather than at finishing.
        if (def.status === 'Planning') {
          setView('deficiencies');
          addToast({ type: 'info', title: 'Write the plan first', message: `${def.id} needs the action, who does it and a due date — the auditor judges it against the root cause.` });
          return;
        }
        // Only the fixing step submits. Anywhere else the finding is in somebody
        // else's hands, and a button that reports success while the store refuses
        // the move is worse than one that says where the thing actually is.
        if (def.status !== 'Remediation') {
          setView('deficiencies');
          addToast({ type: 'info', title: 'Not yours to submit yet', message: `${def.id} is at ${def.status.toLowerCase()} — it comes back to you when the work does.` });
          return;
        }
        if ((def.remediation.evidence?.length ?? 0) > 0) {
          setExceptionStatus(def.id, 'Retest'); // clears this reminder with it
          addToast({ type: 'success', title: 'Submitted for retest', message: `${def.id} is with the auditor — your evidence rides along.` });
        } else {
          setView('deficiencies');
          addToast({ type: 'warning', title: 'Evidence first', message: `Attach proof of the fix on ${def.id}, then submit — “done” needs proof.` });
        }
        return;
      }
    }
    submitTask(t.id);
    addToast({ type: 'success', title: 'Sent to audit', message: 'Submitted — we’ll let you know if more is needed.' });
  };

  const dueTests = testsDueNow(eng.controls.filter(c => isOwnerOf(c, meOwner)));
  const shownTests = dueTests.slice(0, 5);
  const hasWork = dueTests.length > 0 || open.length > 0;
  const anyOverdue = open.some(t => t.overdue) || dueTests.some(c => testDueInDays(c) < 0);
  const headline = [
    dueTests.length > 0 && `${dueTests.length} control test${dueTests.length === 1 ? '' : 's'} due`,
    open.length > 0 && `${open.length} request${open.length === 1 ? '' : 's'} open`,
  ].filter(Boolean).join(' · ');
  // same row anatomy as the auditor's year-end checklist: circle · bold lead · muted context · chevron
  const rowCls = 'w-full flex items-center gap-2.5 py-1.5 px-2 -mx-1 rounded-lg text-left hover:bg-paper-100 transition-colors cursor-pointer group';
  const chevron = <ChevronRight size={14} className="shrink-0 text-ink-300 group-hover:text-ink-500 transition-colors" />;

  return (
    <div className="space-y-5">
      <h1 className="text-[22px] font-bold text-ink-900 tracking-tight" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>Your control tasks</h1>

      {hasWork ? (
        <section className={cn('rounded-2xl border p-4', anyOverdue ? 'border-high-200 bg-high-50/30' : 'border-mitigated-300 bg-mitigated-50/20')}>
          <div className="flex items-center gap-2 flex-wrap">
            <ListChecks size={15} className={anyOverdue ? 'text-high-700' : 'text-brand-600'} />
            <h2 className="text-[13px] font-bold text-ink-800">{headline}</h2>
            <span className="text-[11.5px] text-ink-500">— what needs doing, and by when</span>
          </div>
          <div className="mt-3 space-y-0.5">
            {/* cycle testing — the owner's move is attesting & evidencing on the control */}
            {shownTests.map(c => {
              const dd = testDueInDays(c);
              return (
                <button key={c.id} onClick={() => openControl(c.id)} className={rowCls}>
                  <span className="w-4 flex justify-center shrink-0"><Circle size={11} className={dd < 0 ? 'text-risk-700' : 'text-mitigated-700'} /></span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-700">
                    <b className="font-semibold text-ink-900">{c.wpRef}</b> {c.description} <span className="text-ink-400">· {c.frequency} · attest &amp; evidence</span>
                  </span>
                  <span className={cn('shrink-0 text-[11.5px] font-semibold', dd < 0 ? 'text-risk-700' : 'text-mitigated-700')}>{testDueLabel(dd)}</span>
                  {chevron}
                </button>
              );
            })}
            {dueTests.length > 5 && (
              <button onClick={() => openRegister({ view: 'due' })} className={rowCls}>
                <span className="w-4 shrink-0" />
                <span className="text-[11.5px] text-ink-500">+{dueTests.length - 5} more control tests in the “Due now” view</span>
                <span className="ml-auto" />
                {chevron}
              </button>
            )}
            {/* requests from audit — the row opens the control; the inline link acts without navigating */}
            {open.map(t => {
              const m = TASK_META[t.type];
              // a remediation row says which of the owner's two steps it is on
              const cta = t.type === 'remediation' ? remediationCta(t) : { label: m.action, Icon: m.Icon };
              const urgent = dueNow(t);
              // The task says which step answers it, so the row lands there rather
              // than at the top of a five-step page. A request to upload source
              // data that opens on the design documents is a row that made the
              // reader do the finding themselves.
              return (
                <div key={t.id} role="button" tabIndex={0} onClick={() => openControl(t.controlId, t.focus)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openControl(t.controlId, t.focus); } }}
                  className={rowCls}>
                  <span className="w-4 flex justify-center shrink-0"><Circle size={11} className={t.overdue ? 'text-risk-700' : urgent ? 'text-mitigated-700' : 'text-ink-400'} /></span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-700">
                    <b className="font-semibold text-ink-900">{t.title}</b> <span className="text-ink-400">· {t.controlId} · {m.label}</span>
                  </span>
                  <span className={cn('shrink-0 text-[11.5px] font-semibold', t.overdue ? 'text-risk-700' : urgent ? 'text-mitigated-700' : 'text-ink-400')}>{t.dueLabel}</span>
                  <button onClick={e => { e.stopPropagation(); act(t); }}
                    className="shrink-0 inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer">
                    <cta.Icon size={12} /> {cta.label}
                  </button>
                  {chevron}
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="rounded-2xl border border-canvas-border bg-canvas-elevated p-12 flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-full bg-compliant-50 flex items-center justify-center"><CheckCircle2 size={22} className="text-compliant-700" /></div>
          <p className="text-[15px] font-semibold text-ink-800">You’re all caught up</p>
          <p className="text-[13px] text-ink-500">Nothing needs your attention right now.</p>
        </div>
      )}

      {submitted.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-[12px] font-semibold text-ink-500 uppercase tracking-wide inline-flex items-center gap-1.5"><Inbox size={13} /> With the audit team</h2>
          {submitted.map(t => (
            <div key={t.id} className="rounded-lg border border-canvas-border bg-paper-50/40 px-4 py-2.5 flex items-center gap-3 text-[12.5px]">
              <CheckCircle2 size={15} className="text-compliant-700 shrink-0" />
              <span className="font-mono text-[11px] text-ink-500">{t.controlId}</span>
              <span className="text-ink-700">{t.title}</span>
              <span className="ml-auto text-[11.5px] text-ink-400">Sent to audit</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
