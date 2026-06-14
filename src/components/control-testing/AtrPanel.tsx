import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { FileWarning, Sparkles, CalendarClock, UserCheck, CheckCircle2, XCircle, ShieldCheck, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useToast } from '../shared/Toast';
import { Pill, type Tone } from '../shared/StatusBadge';
import { AsyncButton } from './parts';
import type { AtrStatus, ControlTest, Role, Severity } from './types';
import type { ControlTestingApi } from './useControlTesting';

const SEV_TONE: Record<Severity, Tone> = { Critical: 'risk', High: 'high', Medium: 'mitigated', Low: 'compliant' };
const STATUS_TONE: Record<AtrStatus, Tone> = { Open: 'risk', 'In Remediation': 'mitigated', Closed: 'compliant' };

export function AtrPanel({ control, role, api }: { control: ControlTest; role: Role; api: ControlTestingApi }) {
  const { addToast, updateToast } = useToast();
  const atr = control.atr!;
  const [action, setAction] = useState(atr.managementAction);
  const [date, setDate] = useState(atr.managementActionDate ?? '');
  const [drafting, setDrafting] = useState(false);

  const ownerCanAct = role === 'owner' && atr.status !== 'Closed';
  const closed = atr.status === 'Closed';

  const draftAction = () => {
    setDrafting(true);
    const tId = addToast({ message: 'Drafting a management action with IRA…', type: 'loading' });
    window.setTimeout(() => {
      const draft = `Re-enable the control, add a configuration-drift alert, and recover the impacted amount. Validate with a 30-day monitoring window before closing.`;
      setAction(draft);
      api.updateAtr(control.controlId, { managementAction: draft });
      setDrafting(false);
      updateToast(tId, { type: 'success', message: 'Draft ready — review and set a date' });
    }, 1200);
  };

  const saveplan = () => {
    api.updateAtr(control.controlId, { managementAction: action, managementActionDate: date || null, status: date ? 'In Remediation' : 'Open' });
    addToast({ message: 'Remediation plan saved', type: 'success' });
  };

  const remediate = (pass: boolean) => {
    api.remediate(control.controlId, pass ? 'Pass' : 'Fail');
    addToast({
      title: pass ? 'Remediation verified — loop closed' : 'Remediation not effective',
      message: pass ? `${control.controlId} closed.` : 'ATR stays open for another cycle.',
      type: pass ? 'success' : 'warning',
    });
  };

  return (
    <section className={cn('rounded-xl border overflow-hidden', closed ? 'border-compliant-700/30' : 'border-risk-200')}>
      <header className={cn('flex items-center justify-between gap-3 px-4 py-3 border-b', closed ? 'bg-compliant-50/60 border-compliant-700/20' : 'bg-risk-50/70 border-risk-200/70')}>
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-900">
          <FileWarning size={16} className={closed ? 'text-compliant-700' : 'text-risk-700'} />
          Action Taken Report
          <span className="font-mono text-[11.5px] text-ink-500">{atr.id}</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <Pill tone={SEV_TONE[atr.severity]}>{atr.severity}</Pill>
          <Pill tone={STATUS_TONE[atr.status]}>{atr.status}</Pill>
        </span>
      </header>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Exception"><p className="text-[12.5px] text-ink-700 leading-relaxed">{atr.exception}</p></Field>
          <Field label="Root cause"><p className="text-[12.5px] text-ink-700 leading-relaxed">{atr.rootCause || <span className="text-ink-400">Not documented.</span>}</p></Field>
        </div>

        {/* remediation tracking */}
        <div className="rounded-lg border border-canvas-border bg-paper-50/50 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold inline-flex items-center gap-1.5"><RotateCcw size={13} /> Remediation tracking</span>
            {ownerCanAct && <AsyncButton size="sm" variant="ghost" loading={drafting} icon={<Sparkles size={13} />} onClick={draftAction}>Draft with IRA</AsyncButton>}
          </div>

          <Field label="Management action">
            {ownerCanAct ? (
              <textarea value={action} onChange={(e) => setAction(e.target.value)} rows={2} placeholder="What will management do to remediate?" className="w-full rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2 text-[12.5px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50 resize-none" />
            ) : (
              <p className="text-[12.5px] text-ink-700 leading-relaxed">{atr.managementAction || <span className="text-ink-400">Awaiting management action.</span>}</p>
            )}
          </Field>

          <div className="flex items-end gap-4 flex-wrap">
            <Field label="Management action date">
              {ownerCanAct ? (
                <div className="inline-flex items-center gap-2">
                  <CalendarClock size={15} className="text-ink-400" />
                  <input value={date} onChange={(e) => setDate(e.target.value)} placeholder="e.g. 30 Jun 2026" className="h-9 w-40 rounded-lg border border-canvas-border bg-canvas-elevated px-3 text-[12.5px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50" />
                </div>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-700"><CalendarClock size={14} className="text-ink-400" />{atr.managementActionDate ?? '—'}</span>
              )}
            </Field>
            <Field label="Remediation owner"><span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-700"><UserCheck size={14} className="text-ink-400" />{atr.remediationOwner}</span></Field>
          </div>

          {ownerCanAct && (
            <div className="flex items-center justify-between gap-3 pt-1">
              <button onClick={saveplan} className="text-[12.5px] font-semibold text-brand-700 hover:text-brand-600 cursor-pointer">Save plan</button>
              <div className="flex items-center gap-2">
                <span className="text-[11.5px] text-ink-400">On the action date, verify remediation:</span>
                <button onClick={() => remediate(false)} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-canvas-border text-[12.5px] font-semibold text-ink-600 hover:border-risk-700/40 hover:text-risk-700 transition-colors cursor-pointer"><XCircle size={14} /> Not fixed</button>
                <button onClick={() => remediate(true)} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-compliant-700 text-white text-[12.5px] font-semibold hover:bg-compliant-700/90 transition-colors cursor-pointer"><CheckCircle2 size={14} /> Remediated</button>
              </div>
            </div>
          )}

          <AnimatePresence>
            {closed && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 rounded-lg bg-compliant-50 border border-compliant-700/20 px-3 py-2 text-[12.5px] text-compliant-700 font-medium">
                <ShieldCheck size={15} /> Remediation verified {atr.closedAt}. Loop closed.
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[10.5px] uppercase tracking-wide text-ink-400 font-semibold">{label}</div>
      {children}
    </div>
  );
}
