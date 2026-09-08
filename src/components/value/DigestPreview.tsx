/**
 * The monthly note, previewed.
 *
 * Sent on the first, for the month before, and different for each reader. A
 * finance lead gets the money and the coverage. A team head gets capacity and
 * the people who are not using it. Everybody else gets their own week back,
 * with no money in it at all.
 *
 * The figures below are the real ones for last month, so what is previewed is
 * what would be sent.
 */

import {
  adoptionGap, fmtCapacity, fmtHours, fmtInr, fmtInt, fmtOneDp, fmtPct, formatMonth, ladderRows,
  plural, reviewQueue, snapshot, rangePresets, type ValueSettings,
} from '../../data/value/model';
import { Block, CoverageBar } from './chrome';

export default function DigestPreview({
  settings, team, personEmail, personName,
}: {
  settings: ValueSettings;
  team: string | null;
  personEmail: string;
  personName: string;
}) {
  const r = rangePresets.find(p => p.id === 'last-month')!.make();
  const month = formatMonth(r.from as number);
  const company = snapshot({ persona: 'cfo', subject: 'the company' }, r, settings);
  const teamSnap = team
    ? snapshot({ persona: 'head_of_team', subject: team, team }, r, settings)
    : null;
  const mine = snapshot(
    { persona: 'auditor', subject: 'you', userEmail: personEmail, userName: personName },
    r,
    settings,
  );
  const gap = team ? adoptionGap(team, r, settings).filter(a => a.events === 0) : [];
  const waiting = reviewQueue(settings);
  const stale = ladderRows(r, settings).filter(row => row.stale);

  if (!settings.digestEnabled) {
    return (
      <p className="text-[1rem] leading-relaxed text-ink-800">
        The monthly note is switched off in settings, so nothing is sent.
      </p>
    );
  }

  return (
    <div className="space-y-7">
      <p className="text-[1rem] leading-relaxed text-ink-800">
        This is what would go out on the first, for {month}. Anybody can turn their own off, and a
        scope with no activity is not sent an empty one.
      </p>

      <Block title="To a finance lead or an administrator" hint="The only version with money in it.">
        <Body>
          <p>
            {month} gave back at least {fmtHours(company.hours)}, worth {fmtInr(company.inr)} at ₹
            {fmtInt(settings.hourlyRateInr)} an hour. That is {fmtOneDp(company.auditorMonths)} auditor
            months of capacity, from the {fmtPct(company.coverage.valuedPct)} of the month's work we
            can substantiate.
          </p>
          <p>
            It cost {fmtInr(company.cost.totalInr)} to run, so the month returned at least ₹
            {fmtInt(company.cost.ratio)} for every rupee spent.
            {company.cost.unpricedRows > 0
              ? ` The running cost is itself a floor: ${plural(company.cost.unpricedRows, 'row ran', 'rows ran')} on a model with no published price.`
              : ''}
          </p>
          <div className="pt-1">
            <CoverageBar
              documentedPct={company.coverage.documentedPct}
              measuredPct={company.coverage.measuredPct}
              unvaluedPct={company.coverage.unvaluedPct}
            />
          </div>
          {company.unvalued.length > 0 ? (
            <p>
              The largest gap is {company.unvalued[0].what.toLowerCase()}, at{' '}
              {fmtInt(company.unvalued[0].events)} things counted and none of them valued.{' '}
              {company.unvalued[0].fix}
            </p>
          ) : null}
          <p>
            The workflows that gave back the most were{' '}
            {company.workflows.filter(w => w.basis).slice(0, 3).map(w => w.name).join(', ')}.
          </p>
          {waiting.length > 0 ? (
            <p>
              {plural(waiting.length, 'control was read out of a document', 'controls were read out of documents')} and
              nobody has checked the reading, so {waiting.length === 1 ? 'it counts' : 'they count'} for nothing.
            </p>
          ) : null}
          {stale.length > 0 ? (
            <p>{plural(stale.length, 'workflow rests', 'workflows rest')} on a figure over a year old.</p>
          ) : null}
        </Body>
      </Block>

      {teamSnap ? (
        <Block title="To a team head" hint="Capacity and adoption. No cost figures.">
          <Body>
            <p>
              {team} got back at least {fmtHours(teamSnap.hours)} in {month}, which is{' '}
              {fmtCapacity(teamSnap.hours, settings.hoursPerDay, settings.hoursPerDay * settings.daysPerMonth, 1)}{' '}
              for the month.
            </p>
            <p>
              {teamSnap.members.length === 0
                ? 'Nobody on the team used the platform.'
                : `${teamSnap.members[0].actor.name} got back the most, at ${fmtHours(teamSnap.members[0].hours)}.`}
              {gap.length > 0 ? ` ${gap.map(g => g.actor.name).join(', ')} did nothing on the platform at all.` : ''}
            </p>
            <p>
              {fmtPct(teamSnap.coverage.valuedPct)} of the team's work could be put a figure on. The
              rest is counted and left out.
            </p>
          </Body>
        </Block>
      ) : null}

      <Block title="To everybody else" hint="Their own week. No money, no comparison with anybody.">
        <Body>
          <p>
            {personName}, {month} handed you back at least {fmtHours(mine.hours)}, which is about{' '}
            {fmtOneDp(mine.hours / settings.hoursPerDay)} working days.
          </p>
          <p>
            {mine.events === 0
              ? 'You did not run anything last month, so this one would not be sent.'
              : `You ran ${plural(mine.events, 'thing', 'things')}, and ${fmtInt(mine.valued)} of them can be put a figure on.`}
          </p>
          <p>
            The rest saved you time too. Nobody has established how much, so it is left out rather
            than guessed at.
          </p>
        </Body>
      </Block>

      <Block title="The rules it follows">
        <ul className="space-y-2 text-[0.875rem] leading-relaxed text-ink-500">
          <li>No cost figure reaches anybody but a finance lead or an administrator.</li>
          <li>How much of the month could be valued at all is in every version.</li>
          <li>A control waiting to be checked, or a figure over a year old, is named in it.</li>
          <li>A scope with no activity is not sent a note saying nought.</li>
          <li>Everybody can turn their own off without turning anybody else's off.</li>
        </ul>
      </Block>
    </div>
  );
}

/** The body of a note, set apart so it reads as the thing that would be sent. */
function Body({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-2 border-l-2 border-canvas-border pl-4 text-[0.875rem] leading-relaxed text-ink-800">
      {children}
    </div>
  );
}
