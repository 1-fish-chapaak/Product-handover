/**
 * Platform Usage — how concentrated the work is.
 *
 * "The busiest 3 people do 42% of everything" is the single finding on this page
 * an admin cannot get from any other screen: a healthy-looking total conceals it
 * by construction. You can have 525 actions and a rising trend and still be one
 * resignation away from the platform going quiet.
 *
 * Two earlier drawings were wrong for this reader (a non-technical audit lead):
 *
 *   · A Lorenz curve — cumulative share against rank, read against a dashed
 *     even-split diagonal. The textbook picture, and it asks the reader to read
 *     a gap between two lines on a percentage axis and translate it back into
 *     "how many people". Its caption needed two sentences to explain itself.
 *
 *   · A two-segment split bar (busiest 3 against everyone else) sitting above a
 *     ranked list of names and counts. Two half-pictures instead of one: the bar
 *     showed a proportion with no people in it, the list showed people with no
 *     proportion in them, and 42% ended up printed four times (lede, bar, bar
 *     label, per-row share column). A reader cannot tell what they are meant to
 *     look at when everything is said at once.
 *
 * This is one graph. Every active member is a bar, longest first, and the bars
 * are split into two groups under plain headings: the busiest three, then
 * everyone else. The reliance is the thing you see — a block of long accented
 * bars over a run of shorter grey ones — and the exact share stays in the card's
 * lede sentence, said once. No legend, no key, no ring you have to decode.
 */

import { useMemo } from 'react';
import type { UserUsageRow } from '../../data/platform-usage';
import { Eyebrow } from './usageChrome';
import { fmt, MUTED, SERIES } from './usageTokens';

/** The share at which the page calls concentration a finding (PRD REQ-3.4). */
const CONCENTRATED_AT = 60;

/** The group the card is about: the three busiest. */
const TOP = 3;

/** How many of "everyone else" get their own bar before the tail rolls into one
 *  line of text. A bar for "9 people, 132 actions" would be a lie — it is a sum,
 *  not a person — so the tail is a sentence, never a mark. */
const REST_SHOWN = 9;

export default function UsageConcentration({ rows, topShare }: {
  rows: UserUsageRow[];
  /** The top-3 share the rest of the page prints. Passed in so this card and the
   *  finding can never disagree — they are the same number, drawn and said. */
  topShare: number | null;
}) {
  const { top, rest, tailCount, tailActions, max, active } = useMemo(() => {
    // Only people who did something. A member with zero actions says nothing
    // about how the WORK is spread — "nobody has a seat that does nothing" is a
    // different finding, and the seat funnel above already owns it.
    const doers = rows.filter(r => r.actions > 0).sort((a, b) => b.actions - a.actions);
    const tail = doers.slice(TOP + REST_SHOWN);
    return {
      top: doers.slice(0, TOP),
      rest: doers.slice(TOP, TOP + REST_SHOWN),
      tailCount: tail.length,
      tailActions: tail.reduce((s, r) => s + r.actions, 0),
      max: doers[0]?.actions ?? 0,
      active: doers.length,
    };
  }, [rows]);

  if (active < 2) {
    return (
      <p className="text-[0.875rem] text-ink-400">
        Too few active members in this period to say anything about how the work is spread.
      </p>
    );
  }

  const concentrated = typeof topShare === 'number' && topShare >= CONCENTRATED_AT;
  const restTotal = Math.max(0, active - TOP);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-baseline justify-between">
        <Eyebrow>Busiest {top.length}</Eyebrow>
        <span className="text-[0.75rem] text-ink-400">Actions in this period</span>
      </div>
      <div className="mt-2">
        {top.map(r => (
          <Bar
            key={r.user.email}
            name={r.user.name}
            actions={r.actions}
            max={max}
            accent={concentrated ? SERIES.attention : SERIES.primary}
          />
        ))}
      </div>

      {restTotal > 0 && (
        <>
          {/* The only rule in the card, and it is the finding: above it, the
              people the platform leans on; below it, everyone else. The grouping
              is the encoding, so nothing else has to carry it. */}
          <div className="mt-5 border-t border-canvas-border pt-4">
            <Eyebrow>Everyone else ({restTotal})</Eyebrow>
          </div>
          <div className="mt-2">
            {rest.map(r => (
              <Bar key={r.user.email} name={r.user.name} actions={r.actions} max={max} accent={null} />
            ))}
          </div>
          {tailCount > 0 && (
            <p className="mt-3 text-[0.75rem] text-ink-400">
              {tailCount} more {tailCount === 1 ? 'member' : 'members'} share the remaining {fmt(tailActions)}{' '}
              {tailActions === 1 ? 'action' : 'actions'}.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * One member: name, bar, count. The bar runs against the busiest member, so the
 * longest bar is always full and every other length is read against it — "how
 * much of what the busiest person does". A track behind it would turn a bar
 * chart into a progress meter and invent a target that does not exist, so there
 * is no track; the bar is the only ink.
 */
function Bar({ name, actions, max, accent }: {
  name: string;
  actions: number;
  max: number;
  /** The busiest three carry the page's accent. Everyone else is the recessive
   *  step of the SAME hue: they are the same measure, just not the finding. */
  accent: string | null;
}) {
  const width = max > 0 ? Math.max(2, (actions / max) * 100) : 0;
  return (
    <div className="flex items-center gap-4 py-[9px]">
      <span
        className={`w-[7.5rem] shrink-0 truncate text-[0.875rem] ${accent ? 'font-medium text-ink-900' : 'text-ink-600'}`}
        title={name}
      >
        {name}
      </span>
      <span className="flex-1 min-w-0">
        <span
          className="block h-3.5 rounded-[2px]"
          style={{
            width: `${width}%`,
            background: accent ?? MUTED.primary,
          }}
        />
      </span>
      <span className={`w-8 shrink-0 text-right text-[0.875rem] tabular-nums ${accent ? 'font-semibold text-ink-900' : 'text-ink-500'}`}>
        {fmt(actions)}
      </span>
    </div>
  );
}
