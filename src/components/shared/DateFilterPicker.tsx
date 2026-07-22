import DatePicker from './DatePicker';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Calendar, ChevronDown } from 'lucide-react';

// ─── Date filter model — preset windows + custom range ───────────────────────
// Reused by DataSourcesView and RecentsView. The `today` anchor is injected
// per-caller so each view can use its own deterministic mock anchor or the
// real `new Date()` in production.

export type DateFilter =
  | { kind: 'preset'; id: 'all' | 'today' | '7d' | '30d' | '90d' }
  | { kind: 'custom'; from: string; to: string }; // ISO yyyy-mm-dd

export interface DatePreset {
  id: 'all' | 'today' | '7d' | '30d' | '90d';
  label: string;
  days: number | null;
}

export const DATE_PRESETS: DatePreset[] = [
  { id: 'all',    label: 'All time',     days: null },
  { id: 'today',  label: 'Today',        days: 0 },
  { id: '7d',     label: 'Last 7 days',  days: 7 },
  { id: '30d',    label: 'Last 30 days', days: 30 },
  { id: '90d',    label: 'Last 90 days', days: 90 },
];

export const DEFAULT_DATE_FILTER: DateFilter = { kind: 'preset', id: 'all' };

const DAY_MS = 24 * 60 * 60 * 1000;

export function dateInFilter(iso: string, filter: DateFilter, today: Date): boolean {
  if (filter.kind === 'preset') {
    if (filter.id === 'all') return true;
    const created = new Date(iso);
    if (filter.id === 'today') return created.toDateString() === today.toDateString();
    const preset = DATE_PRESETS.find(r => r.id === filter.id);
    if (!preset?.days) return true;
    const ageMs = today.getTime() - created.getTime();
    return ageMs < preset.days * DAY_MS;
  }
  // custom: inclusive of both endpoints, day-precision
  const created = new Date(iso);
  const from = new Date(filter.from);
  const to = new Date(filter.to);
  to.setHours(23, 59, 59, 999);
  return created.getTime() >= from.getTime() && created.getTime() <= to.getTime();
}

export function isDateFilterActive(filter: DateFilter): boolean {
  return filter.kind !== 'preset' || filter.id !== 'all';
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ── What a preset actually resolves to ──────────────────────────────────────
   "Last 30 days" is a promise about the calendar, and every reader completes it
   the same way: thirty days back from today. On a view whose `today` is a real
   clock that reading is correct. On a view anchored to the newest record — the
   whole of Platform Usage — it is wrong by however stale the data is, and the
   label gives the reader nothing to catch it with: they pick "Last 30 days" in
   July and silently get March 23 to April 21.

   So when a caller opts in, every preset carries the dates it will actually
   hand back, measured from that caller's own anchor. The window is inclusive of
   both ends (N days back from the anchor INCLUDING the anchor day), which is
   exactly what the consuming views slice. */

/** The day `n` days before `d`, in UTC — the same clock every anchored view uses. */
function shiftUtcDays(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - n * DAY_MS);
}

const utcDay = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const utcDayYear = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/**
 * The real dates a preset covers, relative to `today` (the caller's anchor).
 * `earliest` is only needed by "All time" — without it that preset has no
 * knowable start, and says nothing rather than guessing.
 */
export function presetRangeLabel(preset: DatePreset, today: Date, earliest?: Date): string | null {
  if (preset.days === null) {
    return earliest ? `${utcDay(earliest)} – ${utcDayYear(today)}` : null;
  }
  if (preset.days <= 1) return utcDayYear(today);
  const from = shiftUtcDays(today, preset.days - 1);
  return `${utcDay(from)} – ${utcDayYear(today)}`;
}

export function dateFilterLabel(filter: DateFilter): string {
  if (filter.kind === 'preset') return DATE_PRESETS.find(p => p.id === filter.id)?.label ?? 'All time';
  return `${formatShortDate(filter.from)} – ${formatShortDate(filter.to)}`;
}

// ─── Picker component ───────────────────────────────────────────────────────
// Combined popover: preset shortcuts at top + custom from/to inputs below.
// Active state (anything other than "All time") tints the trigger brand-50.

interface DateFilterPickerProps {
  filter: DateFilter;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onApply: (filter: DateFilter) => void;
  /** Anchor "today" used for date input ceiling. Lets callers control mock vs real time. */
  today: Date;
  /** Trigger corner radius (Tailwind class). Defaults to the shared `rounded-md`;
   *  callers can override (e.g. Knowledge Hub uses `rounded-lg` to match its toolbar). */
  triggerRounded?: string;
  /** Trigger height (Tailwind class). Defaults to `h-9`; callers can override
   *  (e.g. Knowledge Hub uses `h-10` to match its toolbar). */
  triggerHeight?: string;
  /** Popover width (Tailwind class). Defaults to `w-[280px]`. */
  panelWidth?: string;
  /** Stack the custom From/To inputs vertically instead of 2-up — needed when
   *  the popover is narrow enough that two date fields won't fit side by side. */
  rangeStacked?: boolean;
  /** Print the real dates each preset resolves to, under its label. Callers whose
   *  `today` is not wall-clock today (Platform Usage anchors on the newest
   *  record) must turn this on, or "Last 30 days" reads as a promise about a
   *  window they will not get. */
  showPresetDates?: boolean;
  /** Oldest day in the caller's series. Only "All time" needs it. */
  earliest?: Date;
}

export function DateFilterPicker({ filter, open, onToggle, onClose, onApply, today, triggerRounded = 'rounded-md', triggerHeight = 'h-9', panelWidth = 'w-[280px]', rangeStacked = false, showPresetDates = false, earliest }: DateFilterPickerProps) {
  const active = isDateFilterActive(filter);
  /* The trigger is the only part of this control most people ever read. Putting
     the shorthand on it ("Last 30 days") and the truth inside the popover means
     the truth is behind a click nobody has a reason to make: the shorthand looks
     complete. So when the presets are anchored rather than wall-clock, the closed
     trigger names the dates too, and the shorthand stays in the popover where the
     choice is being made. A custom range already labels itself this way — this
     just stops presets being the one filter that doesn't. */
  const resolvedLabel = showPresetDates && filter.kind === 'preset'
    ? presetRangeLabel(DATE_PRESETS.find(p => p.id === filter.id) ?? DATE_PRESETS[0], today, earliest)
    : null;
  const label = resolvedLabel ?? dateFilterLabel(filter);
  const todayIso = today.toISOString().slice(0, 10);

  const [from, setFrom] = useState<string>(filter.kind === 'custom' ? filter.from : '');
  const [to, setTo] = useState<string>(filter.kind === 'custom' ? filter.to : '');

  useEffect(() => {
    if (open) {
      setFrom(filter.kind === 'custom' ? filter.from : '');
      setTo(filter.kind === 'custom' ? filter.to : '');
    }
  }, [open, filter]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  const canApplyCustom = from !== '' && to !== '' && new Date(from) <= new Date(to);
  const reduce = useReducedMotion();

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        // Named distinctly from the presets inside the popover: both the trigger
        // and the "Last 30 days" option would otherwise answer to the same
        // accessible name, which is ambiguous to a screen reader and to a test.
        aria-label={`Date range: ${label}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`flex items-center gap-2 px-3 whitespace-nowrap ${triggerHeight} ${triggerRounded} border text-[0.8125rem] font-medium transition-colors cursor-pointer ${
          active
            ? 'border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100'
            : open
              ? 'border-brand-600 bg-canvas text-brand-700'
              : 'border-canvas-border bg-canvas-elevated text-ink-700 hover:border-brand-200'
        }`}
      >
        <Calendar size={14} />
        {label}
        <ChevronDown size={14} className={`text-ink-400 transition-transform ${open ? 'rotate-180 text-brand-600' : ''}`} />
      </button>

      <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={onClose} />
          <motion.div
            initial={reduce ? false : { opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: reduce ? 0 : 0.14, ease: [0.2, 0, 0, 1] }}
            className={`absolute right-0 top-full mt-1 origin-top-right ${panelWidth} z-20 bg-canvas-elevated border border-canvas-border rounded-lg py-2 shadow-lg`}
          >
            {/* Preset shortcuts */}
            <div className="px-1.5 py-1">
              {DATE_PRESETS.map(p => {
                const isCurrent = filter.kind === 'preset' && filter.id === p.id;
                const dates = showPresetDates ? presetRangeLabel(p, today, earliest) : null;
                return (
                  <button
                    key={p.id}
                    onClick={() => onApply({ kind: 'preset', id: p.id })}
                    className={`w-full flex items-center justify-between gap-3 text-left px-2.5 py-1.5 rounded-md text-[0.75rem] cursor-pointer transition-colors ${
                      isCurrent ? 'text-brand-700 font-semibold bg-brand-50' : 'text-ink-700 hover:bg-canvas'
                    }`}
                  >
                    {/* The label is the shorthand; the dates are what you get. The
                        dates sit under it rather than beside it so the column of
                        labels still scans as a list of choices. */}
                    <span className="min-w-0">
                      <span className="block">{p.label}</span>
                      {dates && (
                        <span className={`block mt-0.5 text-[0.6875rem] font-normal tabular-nums truncate ${
                          isCurrent ? 'text-brand-600' : 'text-ink-400'
                        }`}>
                          {dates}
                        </span>
                      )}
                    </span>
                    {isCurrent && <span className="shrink-0 text-[0.625rem] font-semibold uppercase tracking-wide">Active</span>}
                  </button>
                );
              })}
            </div>

            {/* Divider + custom range */}
            <div className="border-t border-canvas-border my-1" />
            <div className="px-3 pt-2 pb-1">
              <div className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-500 mb-2">Custom range</div>
              <div className={`grid gap-2 ${rangeStacked ? 'grid-cols-1' : 'grid-cols-2'}`}>
                <div>
                  <label className="block text-[0.75rem] font-medium text-ink-500 mb-1">From</label>
                  <DatePicker value={from}
                    max={to || todayIso}
                    today={today}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-full h-8 px-2 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-900 focus:outline-none focus:border-brand-600 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[0.75rem] font-medium text-ink-500 mb-1">To</label>
                  <DatePicker value={to}
                    min={from || undefined}
                    max={todayIso}
                    today={today}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-full h-8 px-2 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-900 focus:outline-none focus:border-brand-600 transition-colors"
                  />
                </div>
              </div>
              <button
                onClick={() => canApplyCustom && onApply({ kind: 'custom', from, to })}
                disabled={!canApplyCustom}
                className="w-full mt-3 h-8 rounded-md bg-brand-600 hover:bg-brand-500 disabled:bg-paper-200 disabled:text-ink-400 disabled:cursor-not-allowed text-white text-[0.75rem] font-semibold transition-colors cursor-pointer"
              >
                Apply custom range
              </button>
            </div>
          </motion.div>
        </>
      )}
      </AnimatePresence>
    </div>
  );
}
