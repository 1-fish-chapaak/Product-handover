/**
 * The team view. How much capacity came back, and who is getting the benefit.
 *
 * A team head is not deciding whether to renew anything. They are deciding who
 * to help, so the figure that matters here is not the total: it is the gap
 * between the people using this and the people who are not, and the mix of
 * work they are using it for. A team taking all its value out of low band work
 * is a coaching signal rather than a success.
 *
 * No running cost on this scope. A cost only means something against the whole
 * bill, and a team head cannot act on it.
 */

import {
  BAND_LABEL, BANDS, fmtCapacity, fmtHours, fmtInr, fmtInt, fmtOneDp, fmtPct, fmtSeconds, plural,
  type AdoptionLine, type Benchmarking, type Snapshot, type ValueSettings,
} from '../../data/value/model';
import { GROUP_LABEL } from '../../data/value/settings';
import { Note } from '../usage/chrome';
import { Bars, BasisChip, Block, CoverageBar, Flag, Headline, NotValued, Table } from './chrome';

export default function TeamValue({
  snap, phrase, months, settings, team, adoption, bench, onOpenControls,
}: {
  snap: Snapshot;
  phrase: string;
  months: number;
  settings: ValueSettings;
  team: string;
  adoption: AdoptionLine[];
  bench: Benchmarking;
  onOpenControls: () => void;
}) {
  const monthHours = settings.hoursPerDay * settings.daysPerMonth;
  const floor = snap.coverage.unvaluedPct > 0;
  const quiet = adoption.filter(a => a.events === 0);

  if (snap.events === 0) {
    return (
      <div className="border-t border-canvas-border py-8">
        <p className="text-[1rem] leading-relaxed text-ink-800">
          Nobody on {team} ran anything {phrase}.
        </p>
        <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-500">
          That is a count of nothing happening rather than a figure we could not work out.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-y-5 border-b border-canvas-border pb-5">
        <Headline
          label="Hours returned"
          value={fmtHours(snap.hours)}
          floor={floor}
          sub={`From the ${fmtPct(snap.coverage.valuedPct)} of the team's work we can substantiate`}
        />
        <Headline
          label="Value created"
          value={fmtInr(snap.inr)}
          floor={floor}
          sub={`At ₹${fmtInt(settings.hourlyRateInr)} an hour`}
        />
        <Headline
          label="Capacity freed"
          value={fmtCapacity(snap.hours, settings.hoursPerDay, monthHours, months)}
          floor={floor}
          sub={`Your team of ${adoption.length} got this much of somebody back ${phrase}`}
        />
      </div>

      <div className="py-5">
        <CoverageBar
          documentedPct={snap.coverage.documentedPct}
          measuredPct={snap.coverage.measuredPct}
          unvaluedPct={snap.coverage.unvaluedPct}
          onOpen={onOpenControls}
        />
        <p className="mt-2.5 text-[0.875rem] leading-relaxed text-ink-500">
          {fmtPct(snap.coverage.documentedPct)} of the team's counted work rests on your own control
          documentation and {fmtPct(snap.coverage.measuredPct)} on a timing.{' '}
          {snap.coverage.unvaluedPct === 0
            ? 'Everything counted here has evidence behind it.'
            : settings.reachBackOverHistory
              ? `The other ${fmtPct(snap.coverage.unvaluedPct)} has neither, so the figures above leave it out entirely.`
              : `The other ${fmtPct(snap.coverage.unvaluedPct)} either has neither, or was done before the figure that would value it was supplied.`}
          {snap.valuedFromLaterEvidence > 0
            ? ` ${fmtHours(snap.hoursFromLaterEvidence)} of it is work done before the document or timing that values it was supplied.`
            : ''}
        </p>
      </div>

      <div className="space-y-7">
        <Block
          title="Who is getting the benefit"
          hint="Hours returned by person, with the mix of work each of them put through. A run with no user on it is left out here and counted for the company."
        >
          <Table
            columns={[
              { head: 'Person' },
              { head: 'Runs', align: 'right' },
              { head: 'Chat turns', align: 'right' },
              { head: 'Files', align: 'right' },
              { head: 'Work mix' },
              { head: 'Hours back', align: 'right' },
              { head: 'Value', align: 'right' },
            ]}
            rows={snap.members.map(m => {
              const total = BANDS.reduce((sum, b) => sum + m.bands[b], 0) || 1;
              return [
                m.actor.name,
                fmtInt(m.runs),
                fmtInt(m.turns),
                fmtInt(m.files),
                <span key="mix" className="text-ink-500">
                  {BANDS
                    .filter(b => m.bands[b] > 0)
                    .map(b => `${BAND_LABEL[b].toLowerCase()} ${Math.round((m.bands[b] / total) * 100)}%`)
                    .join(', ')}
                </span>,
                fmtOneDp(m.hours),
                fmtInr(m.inr),
              ];
            })}
          />
        </Block>

        <Block title="Who is not" hint="The line worth acting on. Everybody on the team, quietest first.">
          {quiet.length === 0 ? (
            <Note>Everybody on {team} used the platform {phrase}.</Note>
          ) : (
            <>
              <Table
                columns={[
                  { head: 'Person' },
                  { head: 'Things they did', align: 'right' },
                  { head: 'Hours back', align: 'right' },
                ]}
                rows={adoption.slice(0, 6).map(a => [
                  a.actor.name,
                  a.events === 0 ? <span key="z" className="text-ink-400">nothing</span> : fmtInt(a.events),
                  a.hours === 0 ? <span key="h" className="text-ink-400">none</span> : fmtOneDp(a.hours),
                ])}
              />
              <Flag>
                {quiet.map(q => q.actor.name).join(', ')} did nothing on the platform {phrase}. That
                is either somebody who needs a hand with it or somebody whose work does not suit it,
                and the two need different conversations.
              </Flag>
            </>
          )}
        </Block>

        <Block
          title="Hard work or easy work"
          hint="Share of the team's work against share of its value."
        >
          <Bars
            rows={snap.bands.map(b => ({
              key: b.band,
              label: `${BAND_LABEL[b.band]} band`,
              value: b.counted,
              caption: `${fmtInt(b.counted)} things, ${b.hours === 0 ? 'none valued' : `${fmtHours(b.hours)} back`}`,
            }))}
          />
        </Block>

        <Block
          title="Against the middle of the platform"
          hint="The median team, not a league table. Nobody needs to know they came fourth."
        >
          <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            <Compare
              label="Hours back per person using it"
              mine={fmtOneDp(bench.hoursPerActiveUser)}
              middle={fmtOneDp(bench.medianHoursPerActiveUser)}
            />
            <Compare
              label="Share of the team using it"
              mine={fmtPct(bench.activePct)}
              middle={fmtPct(bench.medianActivePct)}
            />
          </div>
          <Note>
            Read this for coaching rather than for policing. Per person figures for other teams are
            never shown here, on any scope.
          </Note>
        </Block>

        <Block title="What gave it back" hint="The team's hours, by the kind of work behind them.">
          <Bars
            rows={snap.groups.map(g => ({
              key: g.group,
              label: GROUP_LABEL[g.group],
              value: g.hours,
              caption: `${fmtHours(g.hours)}, from ${fmtInt(g.valued)} of ${fmtInt(g.counted)}`,
            }))}
          />
        </Block>

        <Block title="Runs started together" hint="Batching is a habit worth spreading, so who has not picked it up is visible here.">
          {snap.batches.length === 0 ? (
            <Note>
              Nobody on {team} ran anything as a batch {phrase}. A batch pays the setup once where
              doing the same work one at a time pays it every time.
            </Note>
          ) : (
            <Table
              columns={[
                { head: 'Workflow' },
                { head: 'Runs', align: 'right' },
                { head: 'The batch took', align: 'right' },
                { head: 'Setup avoided', align: 'right' },
                { head: 'Extra hours', align: 'right' },
              ]}
              rows={snap.batches.slice(0, 8).map(b => [
                b.name,
                fmtInt(b.runs),
                fmtSeconds(b.wallClockSecs),
                b.setup === null ? <span key="u" className="text-ink-400">not timed</span> : `${fmtInt(b.setup.minutes)} min × ${fmtInt(b.runs - 1)}`,
                b.setup === null ? <span key="e" className="text-ink-400">—</span> : fmtOneDp(b.upliftHours),
              ])}
            />
          )}
        </Block>

        <Block title="The team's workflows" hint="Sorted by hours returned.">
          {snap.workflows.length === 0 ? (
            <Note>
              Nobody on {team} ran a workflow {phrase}. The team's hours above came from chat, from
              files taken in and from government lookups.
            </Note>
          ) : (
            <Table
              columns={[
                { head: 'Workflow' },
                { head: 'Band' },
                { head: 'Control' },
                { head: 'Runs', align: 'right' },
                { head: 'Middle run', align: 'right' },
                { head: 'How we know' },
                { head: 'Hours back', align: 'right' },
              ]}
              rows={snap.workflows.map(w => [
                <span key="n">
                  {w.name}
                  {w.stale ? (
                    <span className="mt-0.5 block text-[0.75rem] text-ink-500">
                      The figure behind it was last confirmed over a year ago
                    </span>
                  ) : null}
                </span>,
                <span key="b" className="text-ink-500">{BAND_LABEL[w.band]}</span>,
                w.controlIds.length > 0 ? w.controlIds.join(', ') : <span key="d" className="text-ink-400">none</span>,
                fmtInt(w.runs),
                fmtSeconds(w.medianSecs),
                w.basis ? <BasisChip key="t" basis={w.basis} small /> : <NotValued key="t" small />,
                w.basis ? fmtOneDp(w.hours) : <span key="h" className="text-ink-400">—</span>,
              ])}
            />
          )}
        </Block>

        {snap.unvalued.length > 0 ? (
          <Block
            title="Counted, and not valued"
            hint="The team's work that nothing documents or times yet."
          >
            <Table
              columns={[
                { head: 'What' },
                { head: 'How much', align: 'right' },
                { head: 'Why it is not valued' },
              ]}
              rows={snap.unvalued.slice(0, 8).map(u => [u.what, fmtInt(u.events), u.reason])}
              caption={`${plural(snap.coverage.unvalued, 'thing your team did is', 'things your team did are')} counted and left out of the hours above.`}
            />
          </Block>
        ) : null}
      </div>
    </>
  );
}

function Compare({ label, mine, middle }: { label: string; mine: string; middle: string }) {
  return (
    <div className="border-b border-canvas-border/60 py-2">
      <p className="text-[0.875rem] text-ink-500">{label}</p>
      <p className="mt-0.5 text-[1rem] tabular-nums text-ink-900">
        <span className="font-semibold">{mine}</span>
        <span className="text-ink-500"> against {middle} at the middle</span>
      </p>
    </div>
  );
}
