/**
 * What the reader has narrowed to.
 *
 * The parent owns the state because the same filters drive both the totals and
 * the rows. Filtering one and not the other would print a total the table below
 * it could never reach.
 *
 * It is the platform's own toolbar, in the platform's own place: the strip at
 * the top of the table's card (SmartTable `headerExtra`), search on the left and
 * the narrowing controls with a "Clear all" link on the right, exactly as
 * Administration carries People and Audit Log. `AdminSelect` replaces every
 * native `<select>` (DESIGN §7.10.7) and `DateFilterPicker` replaces the native
 * `dd/mm/yyyy` fields with the same "All time" control the Knowledge Hub uses,
 * both at the h-10 the platform's filters use. Its presets are resolved against
 * this page's fixed clock (see `usagePeriod`), and it prints the days each one
 * really covers rather than a promise the seeded history cannot keep.
 */

import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { AdminSelect } from '../AdminPrimitives';
import { DateFilterPicker } from '../../shared/DateFilterPicker';
import { periodFilter, periodRange, PERIOD_EARLIEST, PERIOD_TODAY } from './usagePeriod';
import {
  STATUS_OPTIONS,
  SURFACE_OPTIONS,
  TURN_KIND_OPTIONS,
  type UsageFilters,
} from '../../../data/usage/metering';

interface Props {
  value: UsageFilters;
  /** Called with the WHOLE next filter set. */
  onChange: (next: UsageFilters) => void;
}

const H = 'h-10';
/** Administration's own clear-filters link. */
const CLEAR =
  'text-[0.8125rem] font-medium text-brand-700 hover:text-brand-600 transition-colors cursor-pointer';

const ALL = '';

export default function UsageFilterBar({ value, onChange }: Props) {
  const [dateOpen, setDateOpen] = useState(false);
  const set = (patch: Partial<UsageFilters>) => onChange({ ...value, ...patch });
  const active = Object.values(value).some(Boolean);

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-[240px]">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
        />
        <input
          type="text"
          placeholder="Run by"
          value={value.run_by ?? ''}
          onChange={e => set({ run_by: e.target.value })}
          className={`no-focus-ring w-full pl-9 pr-9 ${H} rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] text-ink-800 placeholder:text-ink-400 transition-colors focus:border-brand-300 focus:outline-none`}
        />
        {value.run_by ? (
          <button
            type="button"
            onClick={() => set({ run_by: '' })}
            aria-label="Clear run by"
            className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1 text-ink-400 hover:bg-canvas hover:text-ink-700"
          >
            <X size={12} />
          </button>
        ) : null}
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {active ? (
          <button
            type="button"
            onClick={() => onChange({})}
            className={CLEAR}
          >
            Clear all
          </button>
        ) : null}
        <AdminSelect
          size="md"
          className="w-44"
          ariaLabel="Surface"
          value={value.surface ?? ALL}
          onChange={surface => set({ surface })}
          options={[{ value: ALL, label: 'Every surface' }, ...SURFACE_OPTIONS]}
        />

        <AdminSelect
          size="md"
          className="w-44"
          ariaLabel="Kind of activity"
          value={value.turn_kind ?? ALL}
          onChange={turn_kind => set({ turn_kind })}
          options={[{ value: ALL, label: 'Every kind' }, ...TURN_KIND_OPTIONS]}
        />

        <AdminSelect
          size="md"
          className="w-40"
          ariaLabel="Status"
          value={value.status ?? ALL}
          onChange={status => set({ status })}
          options={[{ value: ALL, label: 'Every status' }, ...STATUS_OPTIONS]}
        />
        <DateFilterPicker
          filter={periodFilter(value.date_from, value.date_to)}
          open={dateOpen}
          onToggle={() => setDateOpen(o => !o)}
          onClose={() => setDateOpen(false)}
          onApply={next => {
            set({ date_from: undefined, date_to: undefined, ...periodRange(next) });
            setDateOpen(false);
          }}
          today={PERIOD_TODAY}
          earliest={PERIOD_EARLIEST}
          showPresetDates
          triggerRounded="rounded-lg"
          triggerHeight="h-10"
        />
      </div>

    </div>
  );
}
