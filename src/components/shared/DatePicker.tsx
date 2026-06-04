import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

// ─── Shared DatePicker ───────────────────────────────────────────────────────
//
// Brand-aligned replacement for the native <input type="date">. The native
// popup can't be themed (system-blue accent, OS chrome), so this renders our
// own calendar in the Editorial GRC language: brand-600 selection, a quiet
// "today" ring, cool-gray hover, and Clear / Today actions.
//
// Drop-in contract: `value` / `onChange` mirror the native input — value is an
// ISO date string ("yyyy-mm-dd") or "", and onChange receives a synthetic
// `{ target: { value } }` so existing `e => setX(e.target.value)` handlers keep
// working untouched. The trigger takes the same `className` as the input it
// replaces so it sits flush with surrounding form fields.
//
// The calendar mounts in a portal and is positioned with fixed coordinates
// (auto-flips above the trigger when there isn't room below), so it never gets
// clipped inside scrolling modals or overflow-hidden panels.

// Week starts Monday.
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const POP_W = 248;
const POP_H = 286;
const GAP = 4;

interface DatePickerProps {
  value?: string;
  onChange?: (e: { target: { value: string } }) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  /** ISO bounds — days outside are not selectable. */
  min?: string;
  max?: string;
  'aria-label'?: string;
  id?: string;
}

function parseISO(v: string | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}
function toISO(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function formatDisplay(d: Date): string {
  // Match the app-wide date style ("May 28, 2026").
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function sameDay(a: Date, b: Date | null): boolean {
  return !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export default function DatePicker({
  value = '',
  onChange,
  className = '',
  disabled = false,
  placeholder = 'Select date',
  min,
  max,
  'aria-label': ariaLabel,
  id,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const today = useMemo(() => startOfDay(new Date()), []);
  const selected = useMemo(() => parseISO(value), [value]);
  const minDate = useMemo(() => parseISO(min), [min]);
  const maxDate = useMemo(() => parseISO(max), [max]);

  const [viewYear, setViewYear] = useState((selected ?? today).getFullYear());
  const [viewMonth, setViewMonth] = useState((selected ?? today).getMonth());
  // Drill-down level: days → click header → months → click year → years. Lets
  // the user jump to a far month/year in ~2 clicks instead of many arrow taps.
  const [mode, setMode] = useState<'day' | 'month' | 'year'>('day');
  const [coords, setCoords] = useState<{ left: number; top?: number; bottom?: number; openUp: boolean } | null>(null);

  // Opening snaps the visible month to the selected date (or today). Done in
  // the handler rather than an effect so there's no extra render on open.
  const openPicker = () => {
    const anchor = selected ?? today;
    setViewYear(anchor.getFullYear());
    setViewMonth(anchor.getMonth());
    setMode('day');
    setOpen(true);
  };
  const toggle = () => {
    if (disabled) return;
    if (open) setOpen(false);
    else openPicker();
  };

  const reposition = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    // Anchor to the trigger's left edge; if that would overflow the right of
    // the viewport, right-align to the trigger instead so the popover stays
    // visually attached to the field rather than floating off to the side.
    let left = r.left;
    if (left + POP_W > window.innerWidth - 8) left = r.right - POP_W;
    left = Math.max(8, Math.min(left, window.innerWidth - POP_W - 8));
    // Prefer opening above the field (it sits over the dropdown rather than
    // hanging below it). Fall back to below only when there isn't room above.
    // When opening up, anchor the popover's BOTTOM edge just above the trigger
    // so we don't need to know the popover height.
    const openUp = r.top >= POP_H + GAP;
    if (openUp) {
      setCoords({ left, bottom: window.innerHeight - r.top + GAP, openUp });
    } else {
      let top = r.bottom + GAP;
      if (top + POP_H > window.innerHeight - 8) top = Math.max(8, window.innerHeight - 8 - POP_H);
      setCoords({ left, top, openUp });
    }
  };

  useLayoutEffect(() => {
    if (!open) return;
    // Position must be measured from the live DOM after the trigger mounts,
    // so setCoords here is the intended measure-then-place pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reposition();
    const onScroll = () => reposition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !popoverRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // 6-week grid starting on Monday. getDay() is 0=Sun..6=Sat; (d+6)%7 maps it
  // to a Monday-first index (Mon=0 … Sun=6) for the leading-day offset.
  const cells = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const gridStart = new Date(viewYear, viewMonth, 1 - ((firstOfMonth.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });
  }, [viewYear, viewMonth]);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const outOfRange = (d: Date) =>
    (minDate && d < startOfDay(minDate)) || (maxDate && d > startOfDay(maxDate));

  const stepMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };
  const stepYear = (delta: number) => setViewYear(y => y + delta);

  const emit = (v: string) => onChange?.({ target: { value: v } });
  const pick = (d: Date) => {
    if (outOfRange(d)) return;
    emit(toISO(d));
    setOpen(false);
  };
  const clear = () => { emit(''); setOpen(false); };
  const goToday = () => {
    if (outOfRange(today)) return;
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    emit(toISO(today));
    setOpen(false);
  };

  const navBtn =
    'w-6 h-6 rounded-md flex items-center justify-center text-ink-400 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
        className={className}
      >
        <span className="flex items-center justify-between gap-2 w-full min-w-0">
          <span className={`truncate ${selected ? '' : 'text-ink-400'}`}>
            {selected ? formatDisplay(selected) : placeholder}
          </span>
          <Calendar size={14} className="text-ink-400 shrink-0" />
        </span>
      </button>

      {createPortal(
        <AnimatePresence>
          {open && coords && (
            <motion.div
              ref={popoverRef}
              role="dialog"
              aria-label="Choose date"
              // The calendar is portaled to <body>, so without this an ancestor
              // popover/modal that closes on a document "mousedown outside" would
              // treat a click on a day as outside-itself and unmount us before
              // the click registers. Stop mousedown from reaching those handlers.
              onMouseDown={e => e.stopPropagation()}
              initial={{ opacity: 0, y: coords.openUp ? 4 : -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: coords.openUp ? 4 : -4, scale: 0.98 }}
              transition={{ duration: 0.14, ease: [0.2, 0, 0, 1] }}
              style={{
                position: 'fixed',
                top: coords.top,
                bottom: coords.bottom,
                left: coords.left,
                width: POP_W,
                zIndex: 'var(--z-popover)' as unknown as number,
              }}
              className="rounded-lg border border-canvas-border bg-canvas-elevated shadow-[0_10px_32px_rgb(15_8_30_/_0.15)] p-2"
            >
              {/* Header — prev / drill-up label / next. The center label climbs
                  the zoom levels: month+year → year → decade, so any date is a
                  couple of clicks away. */}
              <div className="flex items-center justify-between mb-1.5 gap-1">
                <button
                  type="button"
                  className={navBtn}
                  onClick={() => mode === 'day' ? stepMonth(-1) : mode === 'month' ? stepYear(-1) : setViewYear(y => y - 12)}
                  aria-label={mode === 'day' ? 'Previous month' : mode === 'month' ? 'Previous year' : 'Previous years'}
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setMode(mode === 'day' ? 'month' : mode === 'month' ? 'year' : 'year')}
                  disabled={mode === 'year'}
                  className="flex-1 h-6 rounded-md text-[0.75rem] font-semibold text-ink-900 tabular-nums hover:bg-brand-50 hover:text-brand-700 transition-colors cursor-pointer disabled:hover:bg-transparent disabled:cursor-default"
                >
                  {mode === 'day' ? monthLabel : mode === 'month' ? viewYear : `${viewYear - 6}–${viewYear + 5}`}
                </button>
                <button
                  type="button"
                  className={navBtn}
                  onClick={() => mode === 'day' ? stepMonth(1) : mode === 'month' ? stepYear(1) : setViewYear(y => y + 12)}
                  aria-label={mode === 'day' ? 'Next month' : mode === 'month' ? 'Next year' : 'Next years'}
                >
                  <ChevronRight size={14} />
                </button>
              </div>

              {mode === 'day' && (
                <>
                  {/* Weekday header */}
                  <div className="grid grid-cols-7">
                    {WEEKDAYS.map((d, i) => (
                      <div key={i} className="h-6 flex items-center justify-center text-[0.5625rem] font-bold uppercase tracking-wide text-ink-400">
                        {d}
                      </div>
                    ))}
                  </div>
                  {/* Day cells */}
                  <div className="grid grid-cols-7">
                    {cells.map((d, i) => {
                      const inMonth = d.getMonth() === viewMonth;
                      const isToday = sameDay(d, today);
                      const isSelected = sameDay(d, selected);
                      const blocked = !!outOfRange(d);
                      return (
                        <div key={i} className="flex items-center justify-center">
                          <button
                            type="button"
                            disabled={blocked}
                            onClick={() => pick(d)}
                            className={[
                              'relative w-8 h-8 rounded-md text-[0.75rem] tabular-nums transition-colors',
                              blocked ? 'text-ink-300 cursor-not-allowed' : 'cursor-pointer',
                              isSelected
                                ? 'bg-brand-600 text-white font-semibold shadow-[0_2px_6px_rgb(106_18_205_/_0.35)] hover:bg-brand-700'
                                : isToday
                                  ? 'font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-50'
                                  : inMonth
                                    ? 'text-ink-800 font-medium hover:bg-canvas-border/40'
                                    : 'text-ink-300 hover:bg-canvas-border/30',
                            ].filter(Boolean).join(' ')}
                          >
                            {d.getDate()}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {mode === 'month' && (
                <div className="grid grid-cols-3 gap-1 py-1">
                  {MONTHS_SHORT.map((m, i) => {
                    const isCurrent = i === viewMonth;
                    const isSelMonth = !!selected && selected.getFullYear() === viewYear && selected.getMonth() === i;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => { setViewMonth(i); setMode('day'); }}
                        className={[
                          'h-9 rounded-md text-[0.75rem] font-medium transition-colors cursor-pointer',
                          isSelMonth
                            ? 'bg-brand-600 text-white font-semibold hover:bg-brand-700'
                            : isCurrent
                              ? 'text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-50'
                              : 'text-ink-800 hover:bg-canvas-border/40',
                        ].join(' ')}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              )}

              {mode === 'year' && (
                <div className="grid grid-cols-3 gap-1 py-1">
                  {Array.from({ length: 12 }, (_, k) => viewYear - 6 + k).map(y => {
                    const isCurrent = y === viewYear;
                    const isSelYear = !!selected && selected.getFullYear() === y;
                    return (
                      <button
                        key={y}
                        type="button"
                        onClick={() => { setViewYear(y); setMode('month'); }}
                        className={[
                          'h-9 rounded-md text-[0.75rem] font-medium tabular-nums transition-colors cursor-pointer',
                          isSelYear
                            ? 'bg-brand-600 text-white font-semibold hover:bg-brand-700'
                            : isCurrent
                              ? 'text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-50'
                              : 'text-ink-800 hover:bg-canvas-border/40',
                        ].join(' ')}
                      >
                        {y}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-canvas-border">
                <button
                  type="button"
                  onClick={clear}
                  className="px-2 h-6 rounded-md text-[0.6875rem] font-semibold text-ink-500 hover:text-ink-800 hover:bg-canvas-border/40 transition-colors cursor-pointer"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={goToday}
                  disabled={!!outOfRange(today)}
                  className="px-2 h-6 rounded-md text-[0.6875rem] font-semibold text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Today
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
