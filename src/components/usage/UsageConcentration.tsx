/**
 * Platform Usage — how concentrated the work is.
 *
 * "The top 3 people do 42% of everything" is the single finding on this page an
 * admin cannot get from any other screen: a healthy-looking total conceals it by
 * construction. You can have 525 actions and a rising trend and still be one
 * resignation away from the platform going quiet.
 *
 * This used to be drawn as a Lorenz curve — cumulative share against rank, read
 * against a dashed even-split diagonal. It is the textbook way to show
 * concentration, and it was the wrong way to show it HERE: the reader is a
 * non-technical audit lead, and a Lorenz curve asks them to read a gap between
 * two lines on a percentage axis and translate it back into "how many people".
 * Its own caption needed two sentences to explain how to read it, and the ranked
 * bars in the panel beside it already said the same thing. It was the "confusing
 * chart type" the page was told to drop.
 *
 * The finding is the same; the picture is now something a person reads without a
 * key. A single split bar — the busiest three against everyone else — makes the
 * concentration a proportion you see. Under it, the busiest members as ranked
 * bars, so the abstract "42%" has faces and counts behind it.
 */

import { useMemo, type ReactNode } from 'react';
import type { UserUsageRow } from '../../data/platform-usage';
import { Eyebrow } from './usageChrome';
import { InitialsAvatar } from '../admin/AdminPrimitives';
import { fmt } from './usageTokens';

/** The share at which the page calls concentration a finding (PRD REQ-3.4). */
const CONCENTRATED_AT = 60;

/** How many names to list before rolling the tail into one "N more" bar. */
const SHOWN = 6;

export default function UsageConcentration({ rows, topShare }: {
  rows: UserUsageRow[];
  /** The top-3 share the rest of the page prints. Passed in so this card and the
   *  finding can never disagree — they are the same number, drawn and said. */
  topShare: number | null;
}) {
  const { doers, total, active, top3Share, restCount, restActions } = useMemo(() => {
    // Only people who did something. A member with zero actions says nothing
    // about how the WORK is spread — "nobody has a seat that does nothing" is a
    // different finding, and the seat funnel above already owns it.
    const doers = rows.filter(r => r.actions > 0).sort((a, b) => b.actions - a.actions);
    const sum = doers.reduce((s, r) => s + r.actions, 0);
    const top3 = doers.slice(0, 3).reduce((s, r) => s + r.actions, 0);
    const rest = doers.slice(SHOWN);
    return {
      doers,
      total: sum,
      active: doers.length,
      top3Share: sum > 0 ? Math.round((top3 / sum) * 100) : 0,
      restCount: rest.length,
      restActions: rest.reduce((s, r) => s + r.actions, 0),
    };
  }, [rows]);

  if (active < 2) {
    return (
      <p className="text-[0.8125rem] text-ink-400">
        Too few active members in this period to say anything about how the work is spread.
      </p>
    );
  }

  const concentrated = typeof topShare === 'number' && topShare >= CONCENTRATED_AT;
  const restShare = Math.max(0, 100 - top3Share);
  const shown = doers.slice(0, SHOWN);

  return (
    <div className="flex flex-1 flex-col">
      {/* The concentration as one proportion you see, not a gap you subtract.
          Two segments, a 2px surface gap between them so they read as two shares
          of one whole rather than one striped bar. The busiest three carry the
          only hue; everyone else is the recessive step — the same neutral track
          (ink-900/6%) the AI-share split bar and every gauge on the page use, so
          the two split bars read as one language. The reading — "top 3 do 42%" —
          is already the lede at the head of this card and these segment labels,
          so it is not repeated here as a sentence. */}
      <div className="mt-1">
        <div className="flex h-3.5 w-full gap-[2px]">
          <div
            className="rounded-l-full rounded-r-sm"
            style={{
              width: `${top3Share}%`,
              background: concentrated
                ? 'linear-gradient(90deg,#D97A1E,#B45309)'
                : 'linear-gradient(90deg,#8B4FD8,#6A12CD)',
            }}
          />
          <div className="flex-1 rounded-r-full rounded-l-sm bg-ink-900/[0.06]" />
        </div>
        <div className="mt-2 flex items-baseline justify-between text-[0.6875rem]">
          <span className={`font-semibold ${concentrated ? 'text-mitigated-700' : 'text-brand-700'}`}>
            Busiest 3 · {top3Share}%
          </span>
          <span className="text-ink-400">Everyone else ({Math.max(0, active - 3)}) · {restShare}%</span>
        </div>
      </div>

      {/* The names behind the number. The concentration is already drawn once,
          above, as a single split bar — repeating it as seven per-row bars only
          competed with it, and with counts this close (78, 75, 70…) a linear bar
          either reads uniform or shrinks to a stub. So the list drops the bars
          and leads with the figure. The busiest three — the concentration itself
          — are marked by a ring on their avatar, which ties them to the split bar
          without drawing a second chart. */}
      <div className="mt-6 pt-5 border-t border-canvas-border flex-1">
        <div className="flex items-baseline justify-between mb-1">
          <Eyebrow>Busiest members</Eyebrow>
          <span className="text-[0.625rem] text-ink-400">Actions in this period</span>
        </div>
        <div>
          {shown.map((r, i) => (
            <RankRow
              key={r.user.email}
              avatar={<InitialsAvatar name={r.user.name} size={30} />}
              ring={i < 3 ? (concentrated ? 'ring-2 ring-mitigated-700 ring-offset-2 ring-offset-canvas-elevated' : 'ring-2 ring-brand-500 ring-offset-2 ring-offset-canvas-elevated') : ''}
              name={r.user.name}
              nameClass="text-ink-800"
              count={fmt(r.actions)}
              share={total > 0 ? Math.round((r.actions / total) * 100) : 0}
            />
          ))}
          {restCount > 0 && (
            <RankRow
              avatar={
                <div className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-brand-50 text-[0.5625rem] font-semibold text-brand-700">
                  +{restCount}
                </div>
              }
              ring=""
              name={`${restCount} more ${restCount === 1 ? 'member' : 'members'}`}
              nameClass="text-ink-500"
              count={fmt(restActions)}
              share={total > 0 ? Math.round((restActions / total) * 100) : 0}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** One ranked member on a single line: avatar, name, then the count leading its
 *  share. No bar — the split bar above already carries the picture, and the
 *  busiest three are marked instead by a ring on the avatar. */
function RankRow({
  avatar, ring, name, nameClass, count, share,
}: {
  avatar: ReactNode;
  ring: string;
  name: string;
  nameClass: string;
  count: ReactNode;
  share: number;
}) {
  return (
    <div className="flex items-center gap-3 py-[13px] border-b border-canvas-border/50 last:border-b-0">
      <span className={`inline-flex shrink-0 rounded-full ${ring}`}>{avatar}</span>
      <span className={`min-w-0 flex-1 truncate text-[0.875rem] font-medium ${nameClass}`} title={name}>{name}</span>
      <span className="shrink-0 inline-flex items-baseline gap-2.5 tabular-nums">
        <span className="text-[0.9375rem] font-semibold text-ink-900 tracking-[-0.01em]">{count}</span>
        <span className="w-9 text-right text-[0.75rem] text-ink-400">{share}%</span>
      </span>
    </div>
  );
}
