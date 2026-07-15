/**
 * Adoption — the three questions a seat-licensed admin actually has.
 *
 * "Who is using this, is it worth the licence, what should I fix." The metrics
 * come from Amplitude's analytics model (power-user curve, engagement matrix,
 * licence utilisation); the reasoning behind each — and the one Amplitude metric
 * deliberately left out, DAU/MAU — is in platform-usage.ts.
 *
 * Chart choices, for the next person:
 *   · The curve is a distribution over four bands, drawn as horizontal bars from
 *     a shared baseline. It was seven vertical buckets on a light-to-dark ramp,
 *     but over a tenant-sized seat count two of the seven were always empty and
 *     the ramp was encoding nothing the order of the rows did not already say.
 *   · The engagement matrix is the breadth × frequency SCATTER Amplitude uses,
 *     and it lives in `UsageMatrix.tsx`. It was briefly a ranked bar; the reason
 *     that was wrong — a bar cannot tell Set-up from Shelfware, and you must do
 *     opposite things about them — is written up in full at the top of that file.
 */

import { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Gauge } from 'lucide-react';
import type { AdminUser } from '../../context/AdminDataContext';
import {
  powerCurve, licenceUse,
  type UsageDay,
} from '../../data/platform-usage';
import { InitialsAvatar } from '../admin/AdminPrimitives';
import { Card } from './usageChrome';
import { SERIES } from './usageTokens';

/* The one colour that carries an action. Validated against the brand at
 * ΔE 136.6 (protan) — see the dataviz palette check. */
const ATTENTION = SERIES.attention;

/* ── The two ends of the curve ─────────────────────────────────────────────
   The seats to keep, and the seats to act on. One block each: an amber tint on
   the one that carries a to-do, so it reads as a task and not a second statistic.

   The avatar row is the block's whole payload, so it must not lie. It caps at
   six faces and then says "+N" — a six-face stack under a "9 seats" headline,
   with no overflow mark, is a stack that silently contradicts its own number.
   Every face names the fact behind it on hover: how many of the window's days
   that seat did real work, which is the number the two blocks are sorted on. */
const FACE = 26;
const FACES_SHOWN = 6;

function SeatGroup({ tone, heading, caption, people, daysActive, windowDays, emptyNote }: {
  tone: 'keep' | 'act';
  heading: string;
  caption: string;
  people: AdminUser[];
  daysActive: Map<string, number>;
  windowDays: number;
  emptyNote?: string;
}) {
  const act = tone === 'act';
  const shown = people.slice(0, FACES_SHOWN);
  const overflow = people.slice(FACES_SHOWN);
  const dayLabel = (name: string) => {
    const n = daysActive.get(name) ?? 0;
    return `${name} · ${n} of ${windowDays} ${n === 1 ? 'day' : 'days'}`;
  };
  return (
    <div className={`rounded-lg border p-4 ${act ? 'border-mitigated-200/70 bg-mitigated-50' : 'border-brand-100 bg-brand-50/40'}`}>
      <div
        className="text-[0.6875rem] font-semibold uppercase tracking-wide"
        style={{ color: act ? ATTENTION : undefined }}
      >
        <span className={act ? undefined : 'text-brand-700'}>{heading}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-[1.75rem] font-semibold leading-none tracking-[-0.03em] text-ink-900 tabular-nums">
          {people.length}
        </span>
        <span className="text-[0.8125rem] text-ink-500">{people.length === 1 ? 'seat' : 'seats'}</span>
      </div>
      <p className="mt-1 text-[0.75rem] text-ink-500 leading-snug">{caption}</p>

      <div className="mt-3.5 flex items-center">
        {shown.map((p, i) => (
          <div
            key={p.email}
            className={`rounded-full ring-2 ring-canvas-elevated ${i > 0 ? '-ml-2' : ''}`}
            title={dayLabel(p.name)}
          >
            <InitialsAvatar name={p.name} size={FACE} />
          </div>
        ))}
        {overflow.length > 0 && (
          <div
            className={`-ml-2 flex items-center justify-center rounded-full ring-2 ring-canvas-elevated text-[0.625rem] font-semibold tabular-nums ${
              act ? 'bg-mitigated-100 text-mitigated-700' : 'bg-brand-100 text-brand-700'
            }`}
            style={{ width: FACE, height: FACE }}
            title={overflow.map(p => dayLabel(p.name)).join('\n')}
          >
            +{overflow.length}
          </div>
        )}
        {people.length === 0 && emptyNote && (
          <span className="text-[0.75rem] text-ink-400">{emptyNote}</span>
        )}
      </div>
    </div>
  );
}

/** The card every panel on this tab wears. */
function Panel({ icon, title, subtitle, children, className = '' }: {
  icon: typeof Gauge;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card icon={icon} title={title} subtitle={subtitle} className={className}>
      {children}
    </Card>
  );
}

/* ── The power-user curve ─────────────────────────────────────────────────── */

function PowerCurvePanel({ days, users, className }: { days: UsageDay[]; users: AdminUser[]; className?: string }) {
  const prefersReduced = useReducedMotion();
  const curve = useMemo(() => powerCurve(days, users), [days, users]);
  const licence = useMemo(() => licenceUse(days, users), [days, users]);

  /* The day-count that earns the "committed" label — mirrors the threshold the
     data layer sorts on (ceil of half the window), so the caption states the
     exact bar the faces below it cleared. */
  const halfWindow = Math.max(1, Math.ceil(curve.windowDays / 2));

  /* The four bands, folded from the seven raw buckets. Boundaries come from the
     buckets' own min/max, so this stays correct if the edges are ever retuned. */
  const bands = useMemo(() => {
    const fold = (label: string, keep: (b: { min: number; max: number }) => boolean, attention = false) => ({
      label,
      attention,
      seats: curve.buckets.filter(keep).flatMap(b => b.seats),
    });
    return [
      fold('Not once', b => b.max === 0, true),
      fold('1 to 5 days', b => b.min >= 1 && b.max <= 5),
      fold('6 to 14 days', b => b.min >= 6 && b.max <= 14),
      fold('15 or more days', b => b.min >= 15),
    ];
  }, [curve.buckets]);
  const bandMax = Math.max(1, ...bands.map(b => b.seats.length));

  return (
    <Panel
      icon={Gauge}
      title="How often each seat is used"
      subtitle={`Days of real work in the last ${curve.windowDays}`}
      className={className}
    >
      {/* Licence utilisation over the page's window — stated, not drawn.
          It briefly wore a ring of its own, and that was a mistake the moment the
          verdict moved onto this tab: two gauges within one screen of each other,
          reading 65% and 71%, are not two facts a reader combines — they are a
          number that appears to disagree with itself. They measure different
          windows (a fixed week against the date filter), which is exactly the
          distinction a second identical mark destroys.

          One ring per tab, and the hero owns it. This is the same number said in
          words, and the bands under it are what this card is actually for. */}
      {/* The number above the bands names its own window, and it has to. The
          verdict at the top of this tab reads a fixed week (that is what the 60%
          healthy mark is defined against); this reads the date range the page is
          set to. Two true percentages, one screen apart, and without the words
          they look like the page disagreeing with itself. */}
      {/* The summary as one visual stat, not a sentence: the big number, and the
          two counts it is made of. The bands below carry the shape. */}
      <div className="mb-5 flex items-end gap-3">
        <span className="text-[2.25rem] font-semibold leading-none tracking-[-0.03em] text-ink-900 tabular-nums">
          {licence.pct}%
        </span>
        <span className="mb-1 text-[0.8125rem] text-ink-500">
          of seats did real work
          <span className="text-ink-400"> · {licence.used} of {licence.total}</span>
        </span>
      </div>

      {/* Seven buckets over seventeen seats is the 24x7 heatmap's mistake again:
          two of them were empty and two held a single seat, so the reader spent
          their attention on bars that carried no signal. Folded into the four
          bands an admin can act on, the shape says what it always meant: a pile
          that never showed up, and a pile that lives in the product.

          One row per band — label, bar and count on a single line — rather than
          the 28px block with its own label line above. That block sized itself to
          sit beside the engagement funnel; the funnel has since moved to Areas, so
          the panel stands alone and the tall bar was only paying for height the
          card no longer needs. */}
      <div className="space-y-2.5">
        {bands.map((band, i) => {
          const n = band.seats.length;
          const share = licence.total > 0 ? Math.round((n / licence.total) * 100) : 0;
          const attn = band.attention && n > 0;
          return (
            <div
              key={band.label}
              className="flex items-center gap-3"
              title={n === 0 ? `${band.label}: nobody` : `${band.label}: ${band.seats.map(s => s.name).join(', ')}`}
            >
              <span className={`w-28 shrink-0 text-[0.8125rem] leading-snug ${attn ? 'font-semibold text-ink-900' : 'font-medium text-ink-700'}`}>
                {band.label}
              </span>
              <div className={`flex-1 h-2.5 rounded-full overflow-hidden ${attn ? 'bg-mitigated-700/[0.14]' : 'bg-brand-100/70'}`}>
                <motion.div
                  className={`h-full rounded-full ${attn ? 'bg-mitigated-700' : 'bg-brand-600'}`}
                  initial={prefersReduced ? false : { width: 0 }}
                  animate={{ width: `${Math.max(2, (n / bandMax) * 100)}%` }}
                  transition={prefersReduced ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30, delay: 0.04 * i }}
                />
              </div>
              <span className="w-24 shrink-0 whitespace-nowrap text-right text-[0.75rem] text-ink-400 tabular-nums">
                <span className="font-semibold text-ink-900">{n}</span> {n === 1 ? 'seat' : 'seats'}
                {n > 0 && <span className="ml-1 text-ink-300">{share}%</span>}
              </span>
            </div>
          );
        })}
      </div>

      {/* The two ends of the curve are the only two things to act on. */}
      <div className="mt-5 pt-4 border-t border-canvas-border grid grid-cols-2 gap-3">
        <SeatGroup
          tone="keep"
          heading="Using it regularly"
          caption={`Opened it on ${halfWindow} of the last ${curve.windowDays} days or more`}
          people={curve.committed}
          daysActive={curve.daysActive}
          windowDays={curve.windowDays}
        />
        <SeatGroup
          tone="act"
          heading="Barely using it"
          caption="Opened it once, or not at all"
          people={curve.reclaim}
          daysActive={curve.daysActive}
          windowDays={curve.windowDays}
          emptyNote="Nobody — every seat is in use."
        />
      </div>
    </Panel>
  );
}

/* ── The engagement matrix ────────────────────────────────────────────────── */

/**
 * The engagement matrix used to sit here, beside the seat curve.
 *
 * It has moved to the AREAS tab, and the move is the point: a scatter of the
 * twelve areas is a question about the PRODUCT (what do we fix, drop, or invest
 * in), not about the LICENCE (who keeps their seat). Those are two different
 * decisions taken by the same person on different days, and the areas were being
 * rendered three times across three tabs — ranked bars on Overview, this scatter
 * on Adoption, twelve cards on Sections — with no way to see any two at once.
 *
 * On Areas the scatter is the map: click a dot and you land in that area's
 * detail. Here it was a chart you could look at and not act on.
 */
export default function UsageAdoption({ days, users, className }: {
  days: UsageDay[];
  users: AdminUser[];
  className?: string;
}) {
  return <PowerCurvePanel days={days} users={users} className={className} />;
}
