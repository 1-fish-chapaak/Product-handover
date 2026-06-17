import { Upload, CheckCircle2, MessageSquare, Clock, FileWarning, ClipboardList, Inbox } from 'lucide-react';
import { useToast } from '../shared/Toast';
import { useIcfr } from './store';
import { cn } from '../../lib/cn';
import type { HandoffTask, TaskType } from './types';

const TASK_META: Record<TaskType, { label: string; Icon: typeof Upload; tone: string; action: string }> = {
  pbc: { label: 'Document request', Icon: Upload, tone: 'text-evidence-700 bg-evidence-50', action: 'Provide documents' },
  remediation: { label: 'Remediation', Icon: FileWarning, tone: 'text-high-700 bg-high-50', action: 'Mark done' },
  query: { label: 'Question', Icon: MessageSquare, tone: 'text-brand-700 bg-brand-50', action: 'Respond' },
};

export default function RiskOwnerPortal() {
  const { eng, submitTask } = useIcfr();
  const { addToast } = useToast();
  const mine = eng.tasks.filter(t => t.assigneeRole === 'risk-owner');
  const open = mine.filter(t => t.status === 'open');
  const submitted = mine.filter(t => t.status !== 'open');

  const act = (t: HandoffTask) => {
    submitTask(t.id);
    addToast({ type: 'success', title: 'Sent to the audit team', message: t.type === 'remediation' ? 'Marked remediated — they’ll re-test.' : 'Submitted — we’ll let you know if more is needed.' });
  };

  return (
    <div className="max-w-[760px] mx-auto space-y-5">
      <div>
        <h1 className="text-[22px] font-bold text-ink-900 tracking-tight" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>Your control tasks</h1>
        <p className="text-[13px] text-ink-500 mt-0.5">{open.length} open · what the audit team needs from you, and by when.</p>
      </div>

      {open.length === 0 ? (
        <div className="rounded-2xl border border-canvas-border bg-canvas-elevated p-12 flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-full bg-compliant-50 flex items-center justify-center"><CheckCircle2 size={22} className="text-compliant-700" /></div>
          <p className="text-[15px] font-semibold text-ink-800">You’re all caught up</p>
          <p className="text-[13px] text-ink-500">Nothing needs your attention right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {open.map(t => {
            const m = TASK_META[t.type];
            return (
              <div key={t.id} className="rounded-2xl border border-canvas-border bg-canvas-elevated p-4 flex items-start gap-3.5">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', m.tone)}><m.Icon size={18} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-ink-400">{m.label}</span>
                    <span className="font-mono text-[11px] text-ink-500">{t.controlId}</span>
                    <span className={cn('ml-auto text-[11.5px] font-medium inline-flex items-center gap-1', t.overdue ? 'text-risk-700' : 'text-ink-500')}><Clock size={12} />{t.dueLabel}</span>
                  </div>
                  <div className="text-[14px] font-semibold text-ink-900 leading-snug">{t.title}</div>
                  <div className="text-[12.5px] text-ink-600 mt-0.5 leading-relaxed">{t.detail}</div>
                  <div className="mt-2 text-[11.5px] text-ink-400">Raised by {t.raisedBy}</div>
                  <div className="flex items-center gap-2 mt-3">
                    <button onClick={() => act(t)} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-brand-600 text-white text-[13px] font-semibold hover:bg-brand-500 cursor-pointer transition-colors"><m.Icon size={14} /> {m.action}</button>
                    <button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-canvas-border text-[13px] font-semibold text-ink-600 hover:border-brand-300 cursor-pointer transition-colors"><MessageSquare size={14} /> Comment</button>
                  </div>
                </div>
              </div>
            );
          })}
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
              <span className="ml-auto text-[11.5px] text-ink-400">Submitted</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
