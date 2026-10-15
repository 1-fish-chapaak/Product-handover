import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ListChecks, ListTodo, ShieldCheck } from 'lucide-react';
import type { AtrObservation } from './atrTypes';
import { closeoutState, pendingActions, PHASE_LABEL, PHASE_ACTOR } from './atrCloseout';

// ─── One "Manage" CTA per observation ───
// Two pills competing for the same corner — "Manage · Assign" and "Manage
// Exceptions (3)" — read as two unrelated jobs. There is one place to go, and
// two things to manage once you are there: the observation's own close-out
// journey, and the exception rows that rolled up into it.

export interface ObservationExceptionsEntry {
  count: number;
  open: () => void;
}

const ITEM = 'w-full flex items-start gap-2.5 px-3 py-2.5 text-left cursor-pointer transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:opacity-50';

export default function AtrObservationManageMenu({ obs, onObservation, exceptions }: {
  obs: AtrObservation;
  /** Opens the close-out panel for this observation. */
  onObservation: () => void;
  /** The exception rows behind this observation; null when it has none. */
  exceptions?: ObservationExceptionsEntry | null;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const st = closeoutState(obs);
  const phase = st.closed ? (st.falsePositive ? 'False positive' : 'Closed') : PHASE_LABEL[st.phase];
  // What is outstanding on this observation, and who it is waiting on — so the
  // reader can see from the report alone that something needs doing here.
  const due = pendingActions(obs);
  const withWhom = PHASE_ACTOR[st.phase] === 'auditor' ? 'the auditor' : 'the risk owner';
  const dueText = due === 0 ? '' : `${due} action${due === 1 ? '' : 's'} with ${withWhom}`;
  const pick = (run: () => void) => { setOpen(false); run(); };

  return (
    <span ref={wrap} className="relative inline-flex print:hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={dueText ? `${dueText} — next up: ${phase}` : 'Manage this observation and the exceptions behind it'}
        className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-sm text-[0.6875rem] font-semibold cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30 ${
          st.closed ? 'text-compliant-700 bg-compliant-50 hover:bg-compliant-100' : 'text-brand-700 bg-brand-50 hover:bg-brand-100'
        }`}
      >
        {st.closed ? <ShieldCheck size={12} aria-hidden="true" /> : <ListChecks size={12} aria-hidden="true" />}
        Manage
        {due > 0 && (
          <span aria-label={`${dueText} pending`} className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-brand-600 text-white text-[0.5625rem] font-bold tabular-nums">{due}</span>
        )}
        <ChevronDown size={12} aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div role="menu" className="absolute top-[calc(100%+6px)] right-0 z-50 w-[268px] rounded-lg border border-canvas-border bg-canvas-elevated shadow-lg overflow-hidden">
          <button type="button" role="menuitem" onClick={() => pick(onObservation)} className={ITEM}>
            <span className="shrink-0 w-6 h-6 mt-0.5 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center"><ListChecks size={13} aria-hidden="true" /></span>
            <span className="min-w-0">
              <span className="block text-[0.8125rem] font-semibold text-ink-900">Observation</span>
              <span className="block text-[0.6875rem] text-ink-500 leading-snug">
                {dueText ? `${dueText} — next up: ${phase}` : 'Nothing outstanding — assign, classify, act and verify.'}
              </span>
            </span>
          </button>
          <div className="h-px bg-canvas-border" />
          <button type="button" role="menuitem" disabled={!exceptions} onClick={() => exceptions && pick(exceptions.open)} className={ITEM}>
            <span className="shrink-0 w-6 h-6 mt-0.5 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center"><ListTodo size={13} aria-hidden="true" /></span>
            <span className="min-w-0">
              <span className="block text-[0.8125rem] font-semibold text-ink-900">
                Exceptions
                {exceptions && <span className="ml-1 text-ink-400 tabular-nums font-medium">({exceptions.count})</span>}
              </span>
              <span className="block text-[0.6875rem] text-ink-500 leading-snug">
                {exceptions
                  ? 'Work the underlying rows in Manage Exceptions — opens in a new tab'
                  : 'No exception rows are linked to this observation'}
              </span>
            </span>
          </button>
        </div>
      )}
    </span>
  );
}
