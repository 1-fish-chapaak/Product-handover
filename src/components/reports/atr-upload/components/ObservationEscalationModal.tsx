import { useState } from 'react';
import { ChevronDown, ChevronRight, CalendarClock, CircleCheck, BellRing, TriangleAlert } from 'lucide-react';
import Modal from '../../../shared/Modal';
import { Button } from '../../../shared/Button';
import EscalationTimeline from './EscalationTimeline';
import type { ExtractedObservation } from '../types';
import {
  type EscalationMatrixConfig,
  computeEscalationSchedule,
  deriveEscalationState,
  parseDueDate,
  fmtDate,
  ccNames,
} from '../escalationMatrix';

// One "exception case" inside the observation that carries a due date the matrix
// keys off — its management action plans (or the observation's own timeline).
interface EscItem {
  key: string;
  label: string;
  due: Date;
  status?: string;
}

function collectItems(obs: ExtractedObservation): EscItem[] {
  const items: EscItem[] = [];
  (obs.actionPlans ?? []).forEach((p, i) => {
    const due = parseDueDate(p.dueDate);
    if (due) items.push({ key: `ap-${i}`, label: p.title?.trim() || p.text?.trim() || `Action plan ${i + 1}`, due, status: p.status });
  });
  if (items.length === 0) {
    const due = parseDueDate(obs.dueDate);
    if (due) items.push({ key: 'obs', label: 'Observation timeline', due });
  }
  return items;
}

// Current-rung badge derived from where "today" sits in the schedule.
function StatusBadge({ due, config, now }: { due: Date; config: EscalationMatrixConfig; now: Date }) {
  const st = deriveEscalationState(due, config, now);
  let tone = 'bg-paper-100 text-ink-600';
  let Icon = CalendarClock;
  let text = 'Not started';
  if (st.escalating) { tone = 'bg-risk-50 text-risk-700'; Icon = TriangleAlert; text = st.current?.code ?? 'Escalating'; }
  else if (st.current?.kind === 'reminder') { tone = 'bg-mitigated-50 text-mitigated-700'; Icon = BellRing; text = st.current.code; }
  else if (st.current?.kind === 'initial') { tone = 'bg-brand-50 text-brand-700'; Icon = BellRing; text = 'Heads-up sent'; }
  const nextIn = st.next ? Math.round((st.next.date.getTime() - now.getTime()) / 86_400_000) : null;
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-[11px] font-semibold ${tone}`}><Icon size={12} aria-hidden="true" />{text}</span>
      {st.next
        ? <span className="text-[11px] text-ink-500">next <b className="text-ink-700">{st.next.code}</b> {nextIn !== null && nextIn <= 0 ? 'due' : `in ${nextIn}d`}</span>
        : <span className="inline-flex items-center gap-1 text-[11px] text-compliant-700"><CircleCheck size={12} aria-hidden="true" /> schedule complete</span>}
    </div>
  );
}

/**
 * Shows how the report's escalation matrix plays out for one observation — a
 * schedule per exception (management action plan) that carries a due date, with
 * the current rung relative to today. This is the matrix "working" for each case.
 */
export default function ObservationEscalationModal({ obs, config, onClose }: {
  obs: ExtractedObservation;
  config: EscalationMatrixConfig;
  onClose: () => void;
}) {
  const items = collectItems(obs);
  const title = obs.title?.trim() || `Observation #${obs.number}`;
  const [expanded, setExpanded] = useState<string | null>(items[0]?.key ?? null);
  // A single stable "today" for every state calc in this render.
  const [now] = useState(() => new Date());

  const notes: string[] = [];
  if (config.reminderDaily) notes.push(`Reminders send every ${config.weekdaysOnly ? 'weekday' : 'day'} until the exception is handled.`);
  if (config.recurring.enabled) notes.push(`Then repeats every ${config.recurring.everyDays} day${config.recurring.everyDays === 1 ? '' : 's'} to ${ccNames(config.recurring.cc)}, until the status is updated.`);

  return (
    <Modal
      title="Escalation schedule"
      subtitle={`#${obs.number} · ${title}`}
      width="max-w-[720px]"
      onClose={onClose}
      footer={<Button variant="primary" onClick={onClose}>Close</Button>}
    >
      {!config.enabled ? (
        <div className="flex items-center gap-2 rounded-[10px] border border-dashed border-canvas-border bg-canvas px-3 py-4 text-[12.5px] text-ink-500">
          <CalendarClock size={15} className="text-ink-400" aria-hidden="true" />
          Escalation mailers are turned off for this report — no reminders or escalations will be sent.
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center gap-2 rounded-[10px] border border-dashed border-canvas-border bg-canvas px-3 py-4 text-[12.5px] text-ink-500">
          <CalendarClock size={15} className="text-ink-400" aria-hidden="true" />
          No due dates on this observation yet — set a due date on its action plan to activate the schedule.
        </div>
      ) : (
        <>
          <p className="text-[12px] text-ink-500 mb-3">
            The report's escalation matrix runs independently for each exception below, off its own due date. Dates are weekday-adjusted where required.
          </p>
          <div className="space-y-2.5">
            {items.map(item => {
              const open = expanded === item.key;
              const schedule = computeEscalationSchedule(item.due, config);
              const st = deriveEscalationState(item.due, config, now);
              return (
                <div key={item.key} className="rounded-[11px] border border-canvas-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : item.key)}
                    className="w-full flex items-center gap-3 px-3.5 py-3 text-left hover:bg-canvas cursor-pointer transition-colors"
                  >
                    {open ? <ChevronDown size={15} className="text-ink-400 shrink-0" /> : <ChevronRight size={15} className="text-ink-400 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-semibold text-ink-800 truncate">{item.label}</div>
                      <div className="text-[11px] text-ink-500 tabular-nums mt-0.5">Due {fmtDate(item.due)}{item.status ? ` · ${item.status}` : ''}</div>
                    </div>
                    <StatusBadge due={item.due} config={config} now={now} />
                  </button>
                  {open && (
                    <div className="px-3.5 pb-3.5 pt-1 border-t border-canvas-border bg-canvas/50">
                      <EscalationTimeline events={schedule} nextSeq={st.next?.seq} notes={notes} dense />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </Modal>
  );
}
