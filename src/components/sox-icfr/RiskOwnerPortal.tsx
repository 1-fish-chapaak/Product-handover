import { Upload, CheckCircle2, MessageSquare, Clock, FileWarning, Inbox, ArrowRight, FlaskConical } from 'lucide-react';
import { useToast } from '../shared/Toast';
import { useIcfr } from './store';
import { testDueInDays, testDueLabel, testsDueNow } from './helpers';
import { cn } from '../../lib/cn';
import type { HandoffTask, TaskType } from './types';

const TASK_META: Record<TaskType, { label: string; Icon: typeof Upload; tone: string; action: string }> = {
  pbc: { label: 'Document request', Icon: Upload, tone: 'text-evidence-700 bg-evidence-50', action: 'Provide documents' },
  remediation: { label: 'Remediation', Icon: FileWarning, tone: 'text-high-700 bg-high-50', action: 'Mark done' },
  query: { label: 'Question', Icon: MessageSquare, tone: 'text-brand-700 bg-brand-50', action: 'Respond' },
};

export default function RiskOwnerPortal() {
  const { eng, submitTask, openControl, setTab } = useIcfr();
  const { addToast } = useToast();
  const mine = eng.tasks.filter(t => t.assigneeRole === 'risk-owner');
  const dueNow = (t: HandoffTask) => t.overdue || /today/i.test(t.dueLabel);
  // due-today / overdue tasks lead the inbox
  const open = mine.filter(t => t.status === 'open').sort((a, b) => Number(dueNow(b)) - Number(dueNow(a)));
  const submitted = mine.filter(t => t.status !== 'open');

  const act = (t: HandoffTask) => {
    submitTask(t.id);
    addToast({ type: 'success', title: 'Sent to the audit team', message: t.type === 'remediation' ? 'Marked remediated — they’ll re-test.' : 'Submitted — we’ll let you know if more is needed.' });
  };

  const dueTests = testsDueNow(eng.controls);

  return (
    <div className="max-w-[760px] mx-auto space-y-5">
      <div>
        <h1 className="text-[1.375rem] font-bold text-ink-900 tracking-tight" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>Your control tasks</h1>
        <p className="text-[0.8125rem] text-ink-500 mt-0.5">{dueTests.length} control tests due · {open.length} requests open · what needs doing, and by when.</p>
      </div>

      {/* regular testing — every control is due on its cycle; today's tests lead */}
      {dueTests.length > 0 && (
        <div className="rounded-2xl border border-mitigated-300 bg-canvas-elevated overflow-hidden">
          <div className="px-4 py-3 border-b border-canvas-border flex items-center gap-2 bg-mitigated-50/50">
            <FlaskConical size={15} className="text-mitigated-700" />
            <span className="text-[0.8125rem] font-bold text-ink-900">Control tests due today</span>
            <span className="text-[0.71875rem] font-semibold text-mitigated-700 tabular-nums">{dueTests.length}</span>
            <button onClick={() => setTab('controls')} className="ml-auto inline-flex items-center gap-1 text-[0.75rem] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer transition-colors">
              Due now view <ArrowRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-canvas-border/70">
            {dueTests.slice(0, 5).map(c => {
              const dd = testDueInDays(c);
              return (
                <button key={c.id} onClick={() => openControl(c.id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-paper-50 transition-colors cursor-pointer">
                  <span className="wp-ref shrink-0">{c.wpRef}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.78125rem] font-semibold text-ink-900 truncate">{c.description}</span>
                    <span className="block text-[0.6875rem] text-ink-400 mt-0.5">{c.frequency} · {c.process}</span>
                  </span>
                  <span className={cn('text-[0.6875rem] font-semibold rounded-full px-2 h-5 inline-flex items-center shrink-0', dd < 0 ? 'text-risk-700 bg-risk-50' : 'text-mitigated-700 bg-mitigated-50')}>{testDueLabel(dd)}</span>
                  <span className="inline-flex items-center gap-1 text-[0.75rem] font-semibold text-brand-700 shrink-0">Run test <ArrowRight size={12} /></span>
                </button>
              );
            })}
          </div>
          {dueTests.length > 5 && (
            <div className="px-4 py-2 border-t border-canvas-border text-[0.71875rem] text-ink-400">+{dueTests.length - 5} more in the Control Library "Due now" view</div>
          )}
        </div>
      )}

      {open.length === 0 ? (
        <div className="rounded-2xl border border-canvas-border bg-canvas-elevated p-12 flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-full bg-compliant-50 flex items-center justify-center"><CheckCircle2 size={22} className="text-compliant-700" /></div>
          <p className="text-[0.9375rem] font-semibold text-ink-800">You’re all caught up</p>
          <p className="text-[0.8125rem] text-ink-500">Nothing needs your attention right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {open.map(t => {
            const m = TASK_META[t.type];
            const urgent = dueNow(t);
            return (
              // The whole card opens the control's TOD / TOE — buttons act without navigating.
              <div key={t.id} onClick={() => openControl(t.controlId)} role="button" tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter') openControl(t.controlId); }}
                className={cn('rounded-2xl border bg-canvas-elevated p-4 flex items-start gap-3.5 cursor-pointer transition-all hover:shadow-[0_8px_24px_-14px_rgba(15,8,30,0.35)]',
                  urgent ? 'border-mitigated-300 hover:border-mitigated-400' : 'border-canvas-border hover:border-brand-300')}>
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', m.tone)}><m.Icon size={18} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[0.6875rem] font-bold uppercase tracking-wide text-ink-400">{m.label}</span>
                    <span className="font-mono text-[0.6875rem] text-ink-500">{t.controlId}</span>
                    <span className={cn('ml-auto text-[0.71875rem] font-semibold inline-flex items-center gap-1 rounded-full px-2 h-5',
                      t.overdue ? 'text-risk-700 bg-risk-50' : urgent ? 'text-mitigated-700 bg-mitigated-50' : 'text-ink-500')}>
                      <Clock size={12} />{t.dueLabel}
                    </span>
                  </div>
                  <div className="text-[0.875rem] font-semibold text-ink-900 leading-snug">{t.title}</div>
                  <div className="text-[0.78125rem] text-ink-600 mt-0.5 leading-relaxed">{t.detail}</div>
                  <div className="mt-2 text-[0.71875rem] text-ink-400">Raised by {t.raisedBy}</div>
                  <div className="flex items-center gap-2 mt-3">
                    <button onClick={e => { e.stopPropagation(); act(t); }} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-brand-600 text-white text-[0.8125rem] font-semibold hover:bg-brand-500 cursor-pointer transition-colors"><m.Icon size={14} /> {m.action}</button>
                    <button onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-canvas-border text-[0.8125rem] font-semibold text-ink-600 hover:border-brand-300 cursor-pointer transition-colors"><MessageSquare size={14} /> Comment</button>
                    <span className="ml-auto inline-flex items-center gap-1 text-[0.75rem] font-semibold text-brand-700">Open control · TOD / TOE <ArrowRight size={13} /></span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {submitted.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-[0.75rem] font-semibold text-ink-500 uppercase tracking-wide inline-flex items-center gap-1.5"><Inbox size={13} /> With the audit team</h2>
          {submitted.map(t => (
            <div key={t.id} className="rounded-lg border border-canvas-border bg-paper-50/40 px-4 py-2.5 flex items-center gap-3 text-[0.78125rem]">
              <CheckCircle2 size={15} className="text-compliant-700 shrink-0" />
              <span className="font-mono text-[0.6875rem] text-ink-500">{t.controlId}</span>
              <span className="text-ink-700">{t.title}</span>
              <span className="ml-auto text-[0.71875rem] text-ink-400">Submitted</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
