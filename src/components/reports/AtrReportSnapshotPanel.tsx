import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X, History, ChevronDown, ChevronRight, Sparkles, CalendarClock } from 'lucide-react';
import {
  splitEvents, fmtEventDay, fmtEventClock, fmtEventTime, ROLE_TONE,
  type AtrTimeline, type AtrEvent,
} from './atrTimeline';

// ISO ↔ the value a <input type="datetime-local"> understands (local time, no seconds).
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v: string) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString(); };

/** One event row. Applied rows are full-strength; rows after the chosen moment
 *  are dimmed so the user sees what was still to come. */
function EventRow({ ev, applied, isCurrent, onPick }: { ev: AtrEvent; applied: boolean; isCurrent: boolean; onPick: () => void }) {
  const [open, setOpen] = useState(false);
  const obsRef = ev.observationIndex != null ? `OBS-${String(ev.observationIndex + 1).padStart(2, '0')}` : null;
  return (
    <li className={`relative pl-6 ${applied ? '' : 'opacity-50'}`}>
      {/* Timeline spine + node */}
      <span className="absolute left-[7px] top-0 bottom-0 w-px bg-canvas-border" aria-hidden="true" />
      <span className={`absolute left-1 top-[13px] w-[7px] h-[7px] rounded-full ring-2 ring-canvas-elevated ${isCurrent ? 'bg-brand-600 scale-125' : applied ? 'bg-brand-400' : 'bg-ink-300'}`} aria-hidden="true" />
      <button
        type="button"
        onClick={onPick}
        title={`View the report as of ${fmtEventTime(ev.ts)}`}
        className={`w-full text-left rounded-md px-2.5 py-2 -ml-1 transition-colors cursor-pointer ${isCurrent ? 'bg-brand-50/70 ring-1 ring-brand-200' : 'hover:bg-canvas'}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[0.6875rem] tabular-nums text-ink-400 shrink-0 w-[38px]">{fmtEventClock(ev.ts)}</span>
          <span className={`inline-flex items-center h-[18px] px-1.5 rounded-full text-[0.625rem] font-semibold shrink-0 ${ROLE_TONE[ev.role]}`}>{ev.role}</span>
          {obsRef && <span className="text-[0.625rem] font-semibold tabular-nums text-ink-500 shrink-0">{obsRef}</span>}
          {ev.caseId && <span className="text-[0.625rem] font-mono text-ink-400 shrink-0 truncate">{ev.caseId}</span>}
        </div>
        <p className="mt-1 text-[0.8125rem] text-ink-800 leading-snug">{ev.summary}</p>
        <p className="mt-0.5 text-[0.6875rem] text-ink-400">{ev.actor}{ev.observationTitle ? ` · ${ev.observationTitle}` : ''}</p>
      </button>
      {ev.detail && (
        <div className="-ml-1 px-2.5 pb-1">
          <button type="button" onClick={() => setOpen(o => !o)} className="inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-brand-700 hover:underline cursor-pointer">
            {open ? <ChevronDown size={11} aria-hidden="true" /> : <ChevronRight size={11} aria-hidden="true" />} {open ? 'Hide details' : 'Details'}
          </button>
          {open && <p className="mt-1 whitespace-pre-line text-[0.75rem] text-ink-600 leading-relaxed border-l-2 border-canvas-border pl-2.5">{ev.detail}</p>}
        </div>
      )}
    </li>
  );
}

/** The trigger marks itself so the panel can sit beside it. */
export const SNAPSHOT_ANCHOR_ATTR = 'data-atr-snapshot-anchor';

const PANEL_WIDTH = 400;
const GAP = 8;
const PAD = 12;

/** Where the panel goes: under its trigger, right-aligned, clamped to the
 *  viewport. Re-read each frame while open — the sidebar hover-expands and the
 *  report scrolls under a sticky header, so the trigger does move. */
function measureAnchor(): { top: number; left: number; maxHeight: number } {
  const btn = document.querySelector(`[${SNAPSHOT_ANCHOR_ATTR}]`) as HTMLElement | null;
  const vw = window.innerWidth, vh = window.innerHeight;
  const r = btn?.getBoundingClientRect();
  const top = r ? r.bottom + GAP : PAD;
  let left = r ? r.right - PANEL_WIDTH : vw - PANEL_WIDTH - PAD;
  left = Math.min(Math.max(PAD, left), vw - PANEL_WIDTH - PAD);
  return { top, left, maxHeight: Math.max(240, vh - top - PAD) };
}

/** The Report Snapshot panel: a scrubber over every recorded action on this
 *  ATR, a free date-time picker, and the action trail — applied vs. still to
 *  come — for the chosen moment. `asOf` null means "latest".
 *
 *  It overlays the report rather than sitting beside it: reading a snapshot is
 *  a glance back, and re-flowing the document to make room for it would reset
 *  the reader's place in the very thing they are comparing against. */
export default function AtrReportSnapshotPanel({ open, timeline, asOf, onChange, onClose }: {
  open: boolean;
  timeline: AtrTimeline;
  asOf: string | null;
  onChange: (asOf: string | null) => void;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<ReturnType<typeof measureAnchor> | null>(null);

  useEffect(() => {
    if (!open) return;
    let raf = 0;
    let last = '';
    const tick = () => {
      const next = measureAnchor();
      const key = `${next.top}|${next.left}|${next.maxHeight}`;
      if (key !== last) { last = key; setPos(next); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // Drop the position on close, so reopening measures afresh rather than
    // painting one frame where the trigger used to be.
    return () => { cancelAnimationFrame(raf); setPos(null); };
  }, [open]);

  // Escape closes; focus moves in on open and back to the trigger on close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  useEffect(() => {
    if (open) requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
    else (document.querySelector(`[${SNAPSHOT_ANCHOR_ATTR}]`) as HTMLElement | null)?.focus?.({ preventScroll: true });
  }, [open]);

  return <SnapshotBody {...{ open, timeline, asOf, onChange, onClose, reduce, panelRef, anchor: pos }} />;
}

function SnapshotBody({ open, timeline, asOf, onChange, onClose, reduce, panelRef, anchor }: {
  open: boolean;
  timeline: AtrTimeline;
  asOf: string | null;
  onChange: (asOf: string | null) => void;
  onClose: () => void;
  reduce: boolean | null;
  panelRef: React.RefObject<HTMLDivElement | null>;
  anchor: { top: number; left: number; maxHeight: number } | null;
}) {
  const events = useMemo(() => [...timeline.events].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts)), [timeline.events]);
  const { applied, later } = useMemo(() => splitEvents(timeline, asOf ?? undefined), [timeline, asOf]);
  const first = events[0];
  const last = events[events.length - 1];
  // Scrubber position = how many events are applied (0 = before the first).
  const pos = applied.length;
  const currentTs = asOf ?? (last?.ts ?? new Date().toISOString());
  const currentEventId = applied[applied.length - 1]?.id;

  const pickIndex = (n: number) => {
    if (n >= events.length) { onChange(null); return; }
    if (n <= 0) { onChange(first ? first.ts : null); return; }
    onChange(events[n - 1].ts);
  };

  // Group for display: by day, chronological.
  const groups: { day: string; items: AtrEvent[] }[] = [];
  for (const ev of events) {
    const day = fmtEventDay(ev.ts);
    const g = groups[groups.length - 1];
    if (g && g.day === day) g.items.push(ev); else groups.push({ day, items: [ev] });
  }
  const isApplied = (ev: AtrEvent) => applied.some(a => a.id === ev.id);
  const firstLaterId = later[0]?.id;

  const body = (
    <>
      <header className="shrink-0 px-4 pt-3.5 pb-3 border-b border-canvas-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><History size={15} aria-hidden="true" /></span>
            <div className="min-w-0">
              <h3 className="text-[0.875rem] font-semibold text-ink-900 leading-tight">Report Snapshot</h3>
              <p className="text-[0.71875rem] text-ink-500 mt-0.5 leading-snug">Scrub to any moment to see the report — and everything done on it — as it stood then.</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close report snapshot" className="w-7 h-7 rounded-md text-ink-500 hover:text-ink-800 hover:bg-canvas flex items-center justify-center cursor-pointer shrink-0"><X size={15} /></button>
        </div>

        {/* Scrubber */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-[0.6875rem] text-ink-500 mb-1.5">
            <span className="truncate">{first ? `Generated · ${fmtEventDay(first.ts)}` : 'Generated'}</span>
            <span className={asOf ? 'text-ink-400' : 'font-semibold text-brand-700'}>Latest</span>
          </div>
          <input
            type="range"
            min={0}
            max={events.length}
            step={1}
            value={asOf ? pos : events.length}
            onChange={e => pickIndex(Number(e.target.value))}
            aria-label="Report Snapshot"
            aria-valuetext={asOf ? fmtEventTime(currentTs) : 'Latest'}
            className="w-full accent-brand-600 cursor-pointer"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <CalendarClock size={13} className="text-ink-400 shrink-0" aria-hidden="true" />
              <input
                type="datetime-local"
                value={toLocalInput(currentTs)}
                min={first ? toLocalInput(first.ts) : undefined}
                max={toLocalInput(new Date().toISOString())}
                onChange={e => { const iso = fromLocalInput(e.target.value); if (iso) onChange(iso); }}
                aria-label="As of date and time"
                className="h-8 px-2 bg-canvas-elevated border border-canvas-border rounded-md text-[0.75rem] text-ink-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 tabular-nums"
              />
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button type="button" onClick={() => pickIndex(0)} className="h-7 px-2 rounded-md text-[0.6875rem] font-semibold text-ink-600 hover:bg-canvas hover:text-ink-900 cursor-pointer">At generation</button>
              <button type="button" onClick={() => onChange(null)} disabled={!asOf} className="h-7 px-2 rounded-md text-[0.6875rem] font-semibold text-brand-700 hover:bg-brand-50 disabled:text-ink-300 disabled:cursor-not-allowed cursor-pointer">Latest</button>
            </div>
          </div>
        </div>

      </header>

      {/* Action trail */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        {events.length <= 1 && later.length === 0 && (
          <p className="mb-3 flex items-start gap-1.5 text-[0.71875rem] text-ink-500 leading-snug"><Sparkles size={12} className="mt-px shrink-0 text-brand-500" aria-hidden="true" /> Actions taken in Case Management by the Auditor and Risk Owner, and edits saved here, will appear on this trail as they happen.</p>
        )}
        {groups.map(g => (
          <section key={g.day} className="mb-3">
            <h4 className="sticky top-0 z-10 -mx-1 px-1 py-1 bg-canvas-elevated text-[0.625rem] font-semibold uppercase tracking-wide text-ink-400">{g.day}</h4>
            <ul className="mt-1 space-y-0.5">
              {g.items.map(ev => (
                <li key={ev.id} className="list-none">
                  {ev.id === firstLaterId && (
                    <div className="flex items-center gap-2 my-2 pl-6">
                      <span className="flex-1 h-px bg-canvas-border" />
                      <span className="text-[0.625rem] font-semibold uppercase tracking-wide text-ink-400">After this point · not yet applied</span>
                      <span className="flex-1 h-px bg-canvas-border" />
                    </div>
                  )}
                  <ul className="list-none m-0 p-0">
                    <EventRow ev={ev} applied={isApplied(ev)} isCurrent={ev.id === currentEventId && !!asOf} onPick={() => onChange(ev.ts)} />
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && anchor && (
        <div key="atr-snapshot" className="fixed inset-0 z-[70] print:hidden">
          {/* Click-away: invisible, so the report stays fully readable behind it. */}
          <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-label="Report Snapshot"
            initial={{ opacity: 0, scale: reduce ? 1 : 0.96, y: reduce ? 0 : -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: reduce ? 1 : 0.98, y: reduce ? 0 : -3, transition: { duration: reduce ? 0 : 0.12, ease: [0.4, 0, 1, 1] } }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 560, damping: 40, mass: 0.7, opacity: { duration: 0.14 } }}
            style={{ top: anchor.top, left: anchor.left, width: PANEL_WIDTH, maxHeight: anchor.maxHeight, transformOrigin: 'top right' }}
            className="absolute flex flex-col rounded-lg border border-canvas-border bg-canvas-elevated shadow-[0_8px_28px_-8px_rgb(15_8_30_/_0.22)] outline-none overflow-hidden"
          >
            {body}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
