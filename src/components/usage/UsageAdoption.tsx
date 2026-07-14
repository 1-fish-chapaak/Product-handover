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
 *   · The engagement matrix is drawn as a ranked bar, not the breadth x frequency
 *     scatter Amplitude uses. The scatter asked a reader to decode two axes and a
 *     quadrant convention to learn "nobody opens Dashboards"; a sorted bar says it
 *     in one direction. Colour is reserved for the one thing that carries an
 *     action: shelfware. Two hues, both validated for colour-blind separation.
 */

import { useMemo } from 'react';
import { Gauge, Grid2x2, Info } from 'lucide-react';
import type { AdminUser } from '../../context/AdminDataContext';
import {
  powerCurve, engagementMatrix, licenceUse,
  type UsageDay,
} from '../../data/platform-usage';
import { InitialsAvatar } from '../admin/AdminPrimitives';
import { Card, Eyebrow, Meter } from './usageChrome';
import { SERIES } from './usageTokens';

/* The one colour that carries an action. Validated against the brand at
 * ΔE 136.6 (protan) — see the dataviz palette check. */
const ATTENTION = SERIES.attention;

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

function PowerCurvePanel({ days, users }: { days: UsageDay[]; users: AdminUser[] }) {
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
      <div className="mb-6">
        <p className="text-[0.9375rem] text-ink-700 leading-snug">
          <strong className="font-semibold text-ink-900">
            {licence.used} of {licence.total} seats
          </strong>{' '}
          did real work in this period — <span className="font-semibold text-ink-900">{licence.pct}%</span>.
        </p>
        <p className="mt-1.5 text-[0.75rem] text-ink-400">
          The bands below split those seats by how many days they showed up.
        </p>
      </div>

      {/* Seven buckets over seventeen seats is the 24x7 heatmap's mistake again:
          two of them were empty and two held a single seat, so the reader spent
          their attention on bars that carried no signal. Folded into the four
          bands an admin can act on, the shape says what it always meant: a pile
          that never showed up, and a pile that lives in the product.

          Horizontal, because these are counts of one thing against a shared
          baseline, and because the bar next to its name needs no axis. */}
      <div className="space-y-3">
        {bands.map((band, i) => {
          const n = band.seats.length;
          const share = licence.total > 0 ? Math.round((n / licence.total) * 100) : 0;
          return (
            <Meter
              key={band.label}
              index={i}
              tone={band.attention && n > 0 ? 'attention' : 'brand'}
              title={n === 0 ? `${band.label}: nobody` : `${band.label}: ${band.seats.map(s => s.name).join(', ')}`}
              label={
                <span className={band.attention && n > 0 ? 'font-semibold text-ink-900' : undefined}>
                  {band.label}
                </span>
              }
              value={n}
              note={
                <span className="text-ink-400">
                  {n === 1 ? 'seat' : 'seats'}
                  {n > 0 && <span className="ml-1.5 text-ink-300">{share}%</span>}
                </span>
              }
              pct={(n / bandMax) * 100}
            />
          );
        })}
      </div>
      <p className="mt-3 text-[0.625rem] text-ink-400">
        Days each seat did real work, out of the last {curve.windowDays}.
      </p>

      {/* The two ends of the curve are the only two things to act on. */}
      <div className="mt-6 pt-5 border-t border-canvas-border grid grid-cols-2 gap-5">
        <div>
          <Eyebrow className="mb-2.5">Earning the licence</Eyebrow>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[1.25rem] font-semibold text-ink-900 tabular-nums">{curve.committed.length}</span>
            <span className="text-[0.6875rem] text-ink-500">seats, half the period or more</span>
          </div>
          <div className="flex items-center mt-2.5">
            {curve.committed.slice(0, 6).map((p, i) => (
              <div key={p.email} className={i > 0 ? '-ml-1.5' : ''} title={p.name}>
                <InitialsAvatar name={p.name} size={22} />
              </div>
            ))}
          </div>
        </div>
        <div>
          {/* Same rank as the Eyebrow beside it, in the attention tone — so it
              is spelled like one, `tracking-wide` and all. */}
          <div className="text-[0.6875rem] font-semibold uppercase tracking-wide mb-2.5" style={{ color: ATTENTION }}>
            Reclaim or retrain
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[1.25rem] font-semibold text-ink-900 tabular-nums">{curve.reclaim.length}</span>
            <span className="text-[0.6875rem] text-ink-500">seats, one day or none</span>
          </div>
          <div className="flex items-center mt-2.5">
            {curve.reclaim.slice(0, 6).map((p, i) => (
              <div key={p.email} className={i > 0 ? '-ml-1.5' : ''} title={p.name}>
                <InitialsAvatar name={p.name} size={22} />
              </div>
            ))}
            {curve.reclaim.length === 0 && <span className="text-[0.6875rem] text-ink-400">Nobody. Every seat is in use.</span>}
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ── The engagement matrix ────────────────────────────────────────────────── */

function MatrixPanel({ days, users }: { days: UsageDay[]; users: AdminUser[] }) {
  const { points } = useMemo(() => engagementMatrix(days, users), [days, users]);

  const shelfware = points.filter(p => p.quadrant === 'shelfware');

  // Most-used area first. A ranked list answers "what is earning its keep" by
  // reading top to bottom, which is the question the panel asks.
  const ranked = useMemo(
    () => [...points].sort((a, b) => b.breadth - a.breadth || b.frequency - a.frequency),
    [points],
  );

  return (
    <Panel
      icon={Grid2x2}
      title="Which areas earn their keep"
      subtitle="Share of the team that used each area, and how hard they leaned on it"
    >
      {/* This was a breadth x frequency scatter with four named quadrants. It
          carried one more dimension than it earned: to learn "nobody opens
          Dashboards" a reader had to locate a dot, read two axes, and know what
          the bottom-left corner was called. It also needed ~100 lines of
          collision code to stop a dozen labels printing on top of each other.

          A ranked bar says the same thing in one direction. Frequency has not
          been dropped, it is printed on the row: a number you can read beats an
          axis you have to decode. */}
      {/* One track width for every row, so the bars share a baseline and the
          ranking is legible at a glance. */}
      <div className="space-y-3">
        {ranked.map((p, i) => {
          const isShelf = p.quadrant === 'shelfware';
          return (
            <Meter
              key={p.module}
              index={i}
              tone={isShelf ? 'attention' : 'brand'}
              label={
                <span className={isShelf ? 'font-semibold text-ink-900' : undefined}>{p.module}</span>
              }
              value={p.users}
              note={
                <span className="text-ink-400">
                  of {users.length} seats
                  <span className="mx-1.5 text-ink-300">|</span>
                  <span className="font-semibold text-ink-800">{p.frequency}</span> each
                </span>
              }
              pct={p.breadth}
            />
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-canvas-border">
        {shelfware.length > 0 ? (
          <p className="text-[0.75rem] text-ink-700 leading-snug flex items-start gap-2">
            <Info size={13} className="mt-0.5 shrink-0" style={{ color: ATTENTION }} />
            <span>
              <span className="font-semibold text-ink-900">{shelfware.map(p => p.module).join(', ')}</span>{' '}
              {shelfware.length === 1 ? 'is' : 'are'} used by few people, and lightly by those who do. This is the part
              of the platform to improve or drop.
            </span>
          </p>
        ) : (
          <p className="text-[0.75rem] text-ink-700 leading-snug">
            Nothing is sitting on the shelf. Every area is used either broadly or deeply.
          </p>
        )}
      </div>
    </Panel>
  );
}

export default function UsageAdoption({ days, users }: { days: UsageDay[]; users: AdminUser[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <PowerCurvePanel days={days} users={users} />
      <MatrixPanel days={days} users={users} />
    </div>
  );
}
