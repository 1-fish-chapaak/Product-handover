/**
 * The period, whose work, and a way to take the figures away.
 *
 * Three things changed after the reads.
 *
 * · **Scope is two controls, not one.** A single list of seventeen entries put
 *   every colleague's name in front of a reader who only wanted the company
 *   total. Now the first control asks whose work, and the second only appears
 *   with the four teams or the twelve people once that has been answered.
 * · **The period is the two dates.** A row of month buttons sat beside them
 *   saying the same thing twice, so the buttons are gone: one control answers
 *   "which days", and it is the calendar.
 * · **It is the toolbar the rest of the platform uses.** Administration, the
 *   Control Library, Reports and the Knowledge Hub all put their filters in one
 *   strip at the top of a white `rounded-xl` card: the thing you are narrowing
 *   on the left, the narrowing controls and a "Clear all" text link on the
 *   right, every control outlined at h-10. This is that strip, with the same
 *   parts at the same size, so the page does not invent a filter language of
 *   its own. The dates are the Knowledge Hub's own "All time" control, presets
 *   and custom range in one popover, resolved against this page's fixed clock
 *   (see `usagePeriod`).
 *
 * The parts are the platform's own: `AdminSelect` is the canonical dropdown
 * (DESIGN §7.10.7) and `DateFilterPicker` is the date control every list on the
 * platform uses, both keeping their menus and their keyboard handling.
 *
 * The download hands over the page's own arithmetic, one row per piece of work,
 * so a reader who does not believe a total can rebuild it in a spreadsheet.
 */

import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { AdminSelect } from '../admin/AdminPrimitives';
import { BTN_CTA_OUTLINE } from '../admin/adminTokens';
import { DateFilterPicker } from '../shared/DateFilterPicker';
import { periodFilter, periodRange, PERIOD_EARLIEST, PERIOD_TODAY } from '../admin/usage/usagePeriod';
import { TEAMS, ACTORS } from '../../data/usage/seed';
import { useCurrentUser } from '../../context/CurrentUserContext';
import type { ValueScope } from '../../data/usage/value';

/** Administration's own clear-filters link, character for character. */
const CLEAR =
  'text-[0.8125rem] font-medium text-brand-700 hover:text-brand-600 transition-colors cursor-pointer';
export interface RangeAndScope {
  date_from?: string;
  date_to?: string;
  scope: ValueScope;
}

export default function ValueScopeBar({
  value,
  onChange,
  onDownload,
}: {
  value: RangeAndScope;
  onChange: (next: RangeAndScope) => void;
  onDownload: () => void;
}) {
  const [dateOpen, setDateOpen] = useState(false);
  const { can, currentUser } = useCurrentUser();

  /* Scope narrows only as far as permission allows.
     `ad_usage` is the workspace-wide read. `ad_usage_people` held WITHOUT it is
     the team lead: they read their own team and the people in it, and nothing
     else. Before this the control offered every team and every colleague to
     anybody who could open the tab, and "The whole company" carried the whole
     bill with it. */
  const wide = can('ad_usage');
  const ownTeam = useMemo(
    () => ACTORS.find(a => a.email === currentUser?.email)?.team ?? null,
    [currentUser?.email],
  );
  const teams = wide ? TEAMS : ownTeam ? [ownTeam] : [];
  const people = wide ? ACTORS : ACTORS.filter(a => a.team === ownTeam);

  const set = (patch: Partial<RangeAndScope>) => onChange({ ...value, ...patch });
  const narrowed = Boolean(value.date_from || value.date_to || value.scope.kind !== 'company');
  const kind = value.scope.kind;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-3">
      <AdminSelect
        size="md"
        className="w-52"
        ariaLabel="Whose work"
        value={kind}
        onChange={next => {
          if (next === 'company') set({ scope: { kind: 'company' } });
          else if (next === 'team') set({ scope: { kind: 'team', team: teams[0] } });
          else set({ scope: { kind: 'person', email: people[0]?.email ?? '' } });
        }}
        options={[
          // The company total is a workspace read, and it is the scope the bill
          // is shown at, so it is offered only to a workspace reader.
          ...(wide ? [{ value: 'company', label: 'The whole company' }] : []),
          ...(teams.length ? [{ value: 'team', label: wide ? 'One team' : ownTeam! }] : []),
          ...(people.length ? [{ value: 'person', label: 'One person' }] : []),
        ]}
      />

      {/* A reader with exactly one team to look at has already answered this
          in the control before it, so a second dropdown offering the same one
          name is furniture. */}
      {kind === 'team' && teams.length > 1 ? (
        <AdminSelect
          size="md"
          className="w-48"
          ariaLabel="Team"
          value={value.scope.kind === 'team' ? value.scope.team : ''}
          onChange={team => set({ scope: { kind: 'team', team } })}
          options={teams.map(t => ({ value: t, label: t }))}
        />
      ) : null}

      {kind === 'person' ? (
        <AdminSelect
          size="md"
          className="w-48"
          ariaLabel="Person"
          value={value.scope.kind === 'person' ? value.scope.email : ''}
          onChange={email => set({ scope: { kind: 'person', email } })}
          options={people.map(a => ({ value: a.email, label: a.name, hint: a.team }))}
        />
      ) : null}

      <div className="ml-auto flex flex-wrap items-center gap-2">
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
        {narrowed ? (
          <button
            type="button"
            onClick={() =>
              onChange({ scope: wide ? { kind: 'company' } : { kind: 'team', team: teams[0] } })
            }
            className={CLEAR}
          >
            Clear all
          </button>
        ) : null}
        <button
          type="button"
          onClick={onDownload}
          title="Download these figures as a spreadsheet"
          className={BTN_CTA_OUTLINE}
        >
          <Download size={14} />
          Download
        </button>
      </div>
    </div>
  );
}
