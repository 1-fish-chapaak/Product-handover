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
import { Gauge, CircleCheck, CircleAlert } from 'lucide-react';
import type { AdminUser } from '../../context/AdminDataContext';
import {
  powerCurve, licenceUse,
  type UsageDay,
} from '../../data/platform-usage';
import { Card, Meter } from './usageChrome';
import { SERIES } from './usageTokens';

/* The one colour that carries an action. Validated against the brand at
 * ΔE 136.6 (protan) — see the dataviz palette check. */
const ATTENTION = SERIES.attention;

/* ── The two ends of the curve ─────────────────────────────────────────────
   The seats to keep, and the seats to act on. One block each: an amber tint on
   the one that carries a to-do, so it reads as a task and not a second statistic.

   Who is in each block is named in plain first names, not a stack of overlapping
   two-letter avatars. Overlapped, each face hid the next one's initials, so the
   row read as cryptic fragments rather than as people; a short list of names says
   who at a glance, with the full names and each seat's day count on hover. */

/** How many names sit on the line before the rest fold into "+N more". Capped so
 *  a big group cannot spill the list across five lines and wreck the card; the
 *  folded names are still there, one hover away. */
const NAMES_SHOWN = 4;

function SeatGroup({ icon: Icon, tone, heading, caption, people, daysActive, windowDays, emptyNote }: {
  icon: typeof Gauge;
  tone: 'keep' | 'act';
  heading: string;
  caption: string;
  people: AdminUser[];
  daysActive: Map<string, number>;
  windowDays: number;
  emptyNote?: string;
}) {
  const act = tone === 'act';
  const dayLabel = (name: string) => {
    const n = daysActive.get(name) ?? 0;
    return `${name} · ${n} of ${windowDays} ${n === 1 ? 'day' : 'days'}`;
  };
  const shownFirst = people.slice(0, NAMES_SHOWN).map(p => p.name.split(' ')[0]);
  const hiddenCount = Math.max(0, people.length - NAMES_SHOWN);
  return (
    <div className={`rounded-lg border p-4 ${act ? 'border-mitigated-200/70 bg-mitigated-50' : 'border-brand-100 bg-brand-50/40'}`}>
      {/* Icon + label on one line: a tick for the seats that are fine, an alert
          for the ones to act on — so which block is the to-do reads before a word
          is. */}
      <div className="flex items-center gap-2">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${act ? '' : 'bg-brand-100 text-brand-700'}`}
          style={act ? { color: ATTENTION, backgroundColor: 'rgba(180, 83, 9, 0.12)' } : undefined}
        >
          <Icon size={13} strokeWidth={2} aria-hidden />
        </span>
        <span
          className={`text-[0.6875rem] font-semibold uppercase tracking-wide ${act ? '' : 'text-brand-700'}`}
          style={act ? { color: ATTENTION } : undefined}
        >
          {heading}
        </span>
      </div>
      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className="text-[1.75rem] font-semibold leading-none tracking-[-0.03em] text-ink-900 tabular-nums">
          {people.length}
        </span>
        <span className="text-[0.8125rem] text-ink-500">{people.length === 1 ? 'seat' : 'seats'}</span>
      </div>
      <p className="mt-1 text-[0.75rem] text-ink-500 leading-snug">{caption}</p>

      {people.length > 0 ? (
        <p className="mt-3 text-[0.75rem] leading-snug text-ink-600">
          {shownFirst.join(', ')}
          {hiddenCount > 0 && (
            // The rest fold into "+N more", but hovering it shows exactly who —
            // in a real popover, not the browser's title tooltip that the reader
            // could not find. Everyone in the group is listed with their days.
            <span className="group/more relative whitespace-nowrap">
              {' '}
              <span className="cursor-help font-medium text-ink-500 underline decoration-dotted decoration-ink-300 underline-offset-2">
                +{hiddenCount} more
              </span>
              <span className="invisible absolute bottom-full left-0 z-20 mb-1.5 w-max max-w-[15rem] rounded-lg border border-canvas-border bg-canvas-elevated p-2.5 text-[0.6875rem] leading-relaxed text-ink-600 opacity-0 shadow-[0_8px_24px_-6px_rgba(15,7,32,0.16)] transition-opacity duration-150 group-hover/more:visible group-hover/more:opacity-100">
                <span className="mb-1 block font-semibold text-ink-900">All {people.length}</span>
                {people.map(p => (
                  <span key={p.email} className="block">{dayLabel(p.name)}</span>
                ))}
              </span>
            </span>
          )}
        </p>
      ) : emptyNote ? (
        <p className="mt-3 text-[0.75rem] text-ink-400">{emptyNote}</p>
      ) : null}
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
  const curve = useMemo(() => powerCurve(days, users), [days, users]);
  const licence = useMemo(() => licenceUse(days, users), [days, users]);

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

          The bar is the funnel's bar (Meter, size lg): the label and count ride
          above a full-width track, and the fill is a tall rounded block — so the
          two cards on this tab, the seat bands and the seat funnel beside them,
          read as one kind of mark rather than two. */}
      <div className="space-y-2">
        {bands.map((band, i) => {
          const n = band.seats.length;
          const share = licence.total > 0 ? Math.round((n / licence.total) * 100) : 0;
          const attn = band.attention && n > 0;
          return (
            <Meter
              key={band.label}
              index={i}
              size="lg"
              tone={attn ? 'attention' : 'brand'}
              title={n === 0 ? `${band.label}: nobody` : `${band.label}: ${band.seats.map(s => s.name).join(', ')}`}
              label={<span className={attn ? 'font-semibold text-ink-900' : undefined}>{band.label}</span>}
              value={n}
              note={
                <span className="text-ink-400">
                  {n === 1 ? 'seat' : 'seats'}
                  {n > 0 && <span className="ml-1.5">{share}%</span>}
                </span>
              }
              pct={(n / bandMax) * 100}
            />
          );
        })}
      </div>

      {/* The two ends of the curve are the only two things to act on. */}
      <div className="mt-5 pt-4 border-t border-canvas-border grid grid-cols-2 gap-3">
        <SeatGroup
          icon={CircleCheck}
          tone="keep"
          heading="Using it a lot"
          caption="Used it most days"
          people={curve.committed}
          daysActive={curve.daysActive}
          windowDays={curve.windowDays}
        />
        <SeatGroup
          icon={CircleAlert}
          tone="act"
          heading="Barely using it"
          caption="Used it once or never"
          people={curve.reclaim}
          daysActive={curve.daysActive}
          windowDays={curve.windowDays}
          emptyNote="Nobody. Every seat is in use."
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
