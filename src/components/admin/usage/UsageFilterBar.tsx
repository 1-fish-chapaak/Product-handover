/**
 * What the reader has narrowed to.
 *
 * The parent owns the state because the same filters drive both the totals and
 * the rows. Filtering one and not the other would print a total the table below
 * it could never reach.
 */

import { X } from 'lucide-react';
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

const CONTROL =
  'rounded-md border border-canvas-border bg-canvas-elevated px-2 py-1 text-[0.75rem] text-ink-900';
const LABEL = 'flex items-center gap-1.5 text-[0.75rem] text-text-secondary';

export default function UsageFilterBar({ value, onChange }: Props) {
  const set = (patch: Partial<UsageFilters>) => onChange({ ...value, ...patch });
  const active = Object.values(value).some(Boolean);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2">
      <label className={LABEL}>
        Surface
        <select
          className={CONTROL}
          value={value.surface ?? ''}
          onChange={e => set({ surface: e.target.value })}
        >
          <option value="">All</option>
          {SURFACE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className={LABEL}>
        Kind
        <select
          className={CONTROL}
          value={value.turn_kind ?? ''}
          onChange={e => set({ turn_kind: e.target.value })}
        >
          <option value="">All</option>
          {TURN_KIND_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className={LABEL}>
        Status
        <select
          className={CONTROL}
          value={value.status ?? ''}
          onChange={e => set({ status: e.target.value })}
        >
          <option value="">All</option>
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className={LABEL}>
        Run by
        <input
          type="search"
          placeholder="email contains"
          className={`${CONTROL} w-44`}
          value={value.run_by ?? ''}
          onChange={e => set({ run_by: e.target.value })}
        />
      </label>

      <label className={LABEL}>
        From
        <input
          type="date"
          className={CONTROL}
          value={value.date_from ?? ''}
          max={value.date_to || undefined}
          onChange={e => set({ date_from: e.target.value })}
        />
      </label>

      <label className={LABEL}>
        To
        <input
          type="date"
          className={CONTROL}
          value={value.date_to ?? ''}
          min={value.date_from || undefined}
          onChange={e => set({ date_to: e.target.value })}
        />
      </label>

      {active ? (
        <button
          type="button"
          onClick={() => onChange({})}
          className="ml-auto inline-flex cursor-pointer items-center gap-1 rounded-md border border-canvas-border px-2 py-1 text-[0.75rem] text-text-secondary hover:text-ink-900"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      ) : null}
    </div>
  );
}
