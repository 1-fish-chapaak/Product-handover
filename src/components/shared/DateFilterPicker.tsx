import DatePicker from './DatePicker';
import { useEffect, useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

// ─── Date filter model — preset windows + custom range ───────────────────────
// Reused by DataSourcesView and RecentsView. The `today` anchor is injected
// per-caller so each view can use its own deterministic mock anchor or the
// real `new Date()` in production.

export type DateFilter =
  | { kind: 'preset'; id: 'all' | 'today' | '7d' | '30d' | '90d' }
  | { kind: 'custom'; from: string; to: string }; // ISO yyyy-mm-dd

interface DatePreset {
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
}

export function DateFilterPicker({ filter, open, onToggle, onClose, onApply, today, triggerRounded = 'rounded-md', triggerHeight = 'h-9' }: DateFilterPickerProps) {
  const active = isDateFilterActive(filter);
  const label = dateFilterLabel(filter);
  const todayIso = today.toISOString().slice(0, 10);

  const [from, setFrom] = useState<string>(filter.kind === 'custom' ? filter.from : '');
  const [to, setTo] = useState<string>(filter.kind === 'custom' ? filter.to : '');

  useEffect(() => {
    if (open) {
      setFrom(filter.kind === 'custom' ? filter.from : '');
      setTo(filter.kind === 'custom' ? filter.to : '');
    }
  }, [open, filter]);

  const canApplyCustom = from !== '' && to !== '' && new Date(from) <= new Date(to);

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={`flex items-center gap-2 px-3 ${triggerHeight} ${triggerRounded} border text-[0.8125rem] font-medium transition-colors cursor-pointer ${
          active
            ? 'border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100'
            : 'border-canvas-border bg-canvas-elevated text-ink-700 hover:border-brand-200'
        }`}
      >
        <Calendar size={14} />
        {label}
        <ChevronDown size={14} className={`text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={onClose} />
          <div className="absolute right-0 top-full mt-1 w-[280px] z-20 bg-canvas-elevated border border-canvas-border rounded-lg py-2 shadow-lg">
            {/* Preset shortcuts */}
            <div className="px-1.5 py-1">
              {DATE_PRESETS.map(p => {
                const isCurrent = filter.kind === 'preset' && filter.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => onApply({ kind: 'preset', id: p.id })}
                    className={`w-full flex items-center justify-between text-left px-2.5 py-1.5 rounded-md text-[0.75rem] cursor-pointer transition-colors ${
                      isCurrent ? 'text-brand-700 font-semibold bg-brand-50' : 'text-ink-700 hover:bg-canvas'
                    }`}
                  >
                    <span>{p.label}</span>
                    {isCurrent && <span className="text-[0.625rem] font-semibold uppercase tracking-wide">Active</span>}
                  </button>
                );
              })}
            </div>

            {/* Divider + custom range */}
            <div className="border-t border-canvas-border my-1" />
            <div className="px-3 pt-2 pb-1">
              <div className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-500 mb-2">Custom range</div>
              <div className="grid grid-cols-2 gap-2">
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
          </div>
        </>
      )}
    </div>
  );
}
