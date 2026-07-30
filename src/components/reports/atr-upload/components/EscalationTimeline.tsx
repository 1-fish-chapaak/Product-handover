import { Mail, BellRing, TriangleAlert, RefreshCw, CalendarClock } from 'lucide-react';
import type { EscalationEvent, EscalationKind } from '../escalationMatrix';
import { ccLabel, fmtDate } from '../escalationMatrix';

// Per-kind visual tokens — the mailer's urgency, read as colour.
const KIND_META: Record<EscalationKind, { icon: typeof Mail; dot: string; chip: string }> = {
  initial:    { icon: Mail,          dot: 'bg-brand-500',     chip: 'bg-brand-50 text-brand-700' },
  reminder:   { icon: BellRing,      dot: 'bg-mitigated-500', chip: 'bg-mitigated-50 text-mitigated-700' },
  escalation: { icon: TriangleAlert, dot: 'bg-risk-500',      chip: 'bg-risk-50 text-risk-700' },
  recurring:  { icon: RefreshCw,     dot: 'bg-risk-600',      chip: 'bg-risk-50 text-risk-700' },
};

/**
 * Vertical timeline of computed escalation mailers. Shared by the config modal's
 * live preview and the per-observation escalation view on the ATR, so both read
 * the same schedule the same way. When `todayLabel` context is given, the first
 * not-yet-fired event is marked "next".
 */
export default function EscalationTimeline({
  events,
  nextSeq,
  notes,
  dense,
}: {
  events: EscalationEvent[];
  /** seq of the event that is "next up" relative to today (highlights it). */
  nextSeq?: number;
  /** Footnotes about open-ended behaviour (daily reminders, recurrence). */
  notes?: string[];
  /** Tighter spacing for embedding in narrow surfaces. */
  dense?: boolean;
}) {
  if (events.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-[10px] border border-dashed border-canvas-border bg-canvas px-3 py-3 text-[12px] text-ink-500">
        <CalendarClock size={14} className="text-ink-400" aria-hidden="true" />
        No due date yet — set one to see the escalation schedule.
      </div>
    );
  }

  return (
    <div>
      <ol className="relative">
        {events.map((e, i) => {
          const m = KIND_META[e.kind];
          const Icon = m.icon;
          const isNext = e.seq === nextSeq;
          const last = i === events.length - 1;
          return (
            <li key={e.seq} className={`relative flex gap-3 ${dense ? 'pb-2.5' : 'pb-3.5'} ${last ? 'pb-0' : ''}`}>
              {/* connector rail */}
              {!last && <span className="absolute left-[13px] top-6 bottom-0 w-px bg-canvas-border" aria-hidden="true" />}
              <span className={`relative z-10 mt-0.5 w-[27px] h-[27px] rounded-full flex items-center justify-center shrink-0 ${m.chip} ring-2 ${isNext ? 'ring-brand-400' : 'ring-canvas-elevated'}`}>
                <Icon size={13} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center h-[18px] px-1.5 rounded-[5px] text-[10px] font-bold tabular-nums ${m.chip}`}>{e.code}</span>
                  <span className="text-[12.5px] font-semibold text-ink-800">{e.title}</span>
                  <span className="text-[11.5px] text-ink-400">·</span>
                  <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-ink-600 tabular-nums">
                    {fmtDate(e.date)}
                    {e.rolledFromWeekend && <span className="text-[10px] text-ink-400" title="Rolled off the weekend to a weekday">(→ weekday)</span>}
                  </span>
                  {isNext && <span className="inline-flex items-center h-[18px] px-1.5 rounded-full text-[10px] font-semibold bg-brand-600 text-white">Next</span>}
                </div>
                <div className="text-[11px] text-ink-500 mt-0.5">
                  cc <span className="font-medium text-ink-600">{ccLabel(e.cc)}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {notes?.map((note, i) => (
        <p key={i} className="mt-2.5 flex items-start gap-1.5 text-[11px] text-ink-500 leading-snug">
          <RefreshCw size={11} className="mt-0.5 shrink-0 text-risk-500" aria-hidden="true" />
          {note}
        </p>
      ))}
    </div>
  );
}
