/**
 * Your own view. How much of your week this handed back.
 *
 * Small and personal, and no money anywhere. An auditor reading their own line
 * is not deciding whether to renew a contract, and putting a rupee figure on
 * their own hours reads as a performance measure rather than as a help.
 */

import {
  fmtHours, fmtInt, fmtOneDp, fmtPct, fmtSeconds, formatDate, plural,
  type Snapshot, type ValueSettings, type WinLine,
} from '../../data/value/model';
import { GROUP_LABEL } from '../../data/value/settings';
import { Note } from '../usage/chrome';
import { Bars, BasisChip, Block, CoverageBar, Headline, StackedWeeks, Table } from './chrome';

export default function MyValue({
  snap, phrase, settings, wins, name,
}: {
  snap: Snapshot;
  phrase: string;
  settings: ValueSettings;
  wins: WinLine[];
  name: string;
}) {
  const days = snap.hours / settings.hoursPerDay;
  const floor = snap.coverage.unvaluedPct > 0;

  if (snap.events === 0) {
    return (
      <div className="border-t border-canvas-border py-8">
        <p className="text-[1rem] leading-relaxed text-ink-800">
          You did not run anything {phrase}.
        </p>
        <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-500">
          That is a count of nothing happening rather than a figure we could not work out. A few
          runs across the workspace carry no user at all, and those count for the company and for
          nobody here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-y-5 border-b border-canvas-border pb-5">
        <Headline
          label="Hours you got back"
          value={fmtHours(snap.hours)}
          floor={floor}
          sub={`About ${fmtOneDp(days)} working days, at ${fmtInt(settings.hoursPerDay)} hours a day`}
        />
        <Headline
          label="What it would have taken you"
          value={fmtHours(snap.manualHours)}
          floor={floor}
          sub={`The platform took ${fmtSeconds(snap.machineSeconds)} of it`}
        />
        <Headline
          label="Things you ran"
          value={fmtInt(snap.events)}
          sub={`${fmtInt(snap.valued)} of them can be put a figure on`}
        />
      </div>

      <div className="py-5">
        <CoverageBar
          documentedPct={snap.coverage.documentedPct}
          measuredPct={snap.coverage.measuredPct}
          unvaluedPct={snap.coverage.unvaluedPct}
        />
        <p className="mt-2.5 text-[0.875rem] leading-relaxed text-ink-500">
          {name}, the hours above come only from work where your own control documentation or a
          timing says how long it takes by hand.{' '}
          {snap.coverage.unvaluedPct === 0
            ? 'Everything you did in this range has evidence behind it.'
            : settings.reachBackOverHistory
              ? `The other ${fmtPct(snap.coverage.unvaluedPct)} of what you did almost certainly saved you time too, and nobody has established how much, so it is left out rather than guessed at.`
              : `The other ${fmtPct(snap.coverage.unvaluedPct)} either has nothing behind it, or was done before the figure that would value it was supplied.`}
        </p>
      </div>

      <div className="space-y-7">
        <Block title="Your best five" hint="The single things that gave the most back.">
          {wins.length === 0 ? (
            <Note>Nothing you ran {phrase} has evidence behind it yet, so there is no best five.</Note>
          ) : (
            <Table
              columns={[
                { head: 'What ran' },
                { head: 'When', align: 'right' },
                { head: 'It took', align: 'right' },
                { head: 'How we know' },
                { head: 'You got back', align: 'right' },
              ]}
              rows={wins.map(w => [
                w.name,
                formatDate(w.at),
                fmtSeconds(w.machineSecs),
                <BasisChip key="t" basis={w.basis} small />,
                fmtHours(w.savedHours),
              ])}
            />
          )}
        </Block>

        <Block title="Week by week" hint="Hours back, over the range.">
          <StackedWeeks
            stacks={snap.weeks.map(w => ({
              at: w.at,
              total: w.total,
              parts: [
                { key: 'workflow', value: w.workflow, fill: 'bg-ink-800' },
                { key: 'chat', value: w.chat, fill: 'bg-ink-600' },
                { key: 'ingestion', value: w.ingestion, fill: 'bg-ink-400' },
                { key: 'govt', value: w.govt, fill: 'bg-ink-300' },
              ],
            }))}
            labelFor={formatDate}
          />
        </Block>

        <Block title="What gave it back">
          <Bars
            rows={snap.groups.map(g => ({
              key: g.group,
              label: GROUP_LABEL[g.group],
              value: g.hours,
              caption: g.hours === 0
                ? `${fmtInt(g.counted)} things, none of them valued yet`
                : `${fmtHours(g.hours)}, from ${fmtInt(g.valued)} of ${fmtInt(g.counted)}`,
            }))}
          />
          <Note>
            Asking the platform to suggest a workflow, or to name one, is not in here at all. There
            was never a version of that job you did by hand.
          </Note>
        </Block>

        {snap.unvalued.length > 0 ? (
          <Block
            title="Yours that is not valued yet"
            hint="Counted, and left out of the hours above."
          >
            <Table
              columns={[
                { head: 'What' },
                { head: 'How much', align: 'right' },
                { head: 'Why' },
              ]}
              rows={snap.unvalued.slice(0, 6).map(u => [
                u.what,
                fmtInt(u.events),
                u.reason,
              ])}
              caption={`${plural(snap.coverage.unvalued, 'thing you did is', 'things you did are')} counted here and not turned into hours.`}
            />
          </Block>
        ) : null}
      </div>
    </>
  );
}
