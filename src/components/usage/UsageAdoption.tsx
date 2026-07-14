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
import { motion, useReducedMotion } from 'motion/react';
import { Gauge, Grid2x2, Info } from 'lucide-react';
import type { AdminUser } from '../../context/AdminDataContext';
import {
  powerCurve, engagementMatrix, licenceUse,
  type UsageDay,
} from '../../data/platform-usage';
import { InitialsAvatar } from '../admin/AdminPrimitives';
import { Card, Eyebrow } from './usageChrome';

/* The one colour that carries an action. Validated against the brand at
 * ΔE 136.6 (protan) — see the dataviz palette check. */
const ATTENTION = '#B45309';
const BRAND = '#6A12CD';

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
  const prefersReduced = useReducedMotion();
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
      {/* Licence utilisation — the headline the admin is here for. */}
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-[1.875rem] font-semibold tracking-[-0.02em] text-ink-900 tabular-nums leading-none">
          {licence.pct}%
        </span>
        <span className="text-[0.75rem] text-ink-500">
          of {licence.total} seats did real work
        </span>
      </div>
      <div className="h-2 rounded-full bg-ink-900/[0.06] overflow-hidden mb-7">
        <motion.div
          className="h-full rounded-full bg-brand-600"
          initial={prefersReduced ? false : { width: 0 }}
          animate={{ width: `${Math.max(2, licence.pct)}%` }}
          transition={prefersReduced ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30 }}
        />
      </div>

      {/* Seven buckets over seventeen seats is the 24x7 heatmap's mistake again:
          two of them were empty and two held a single seat, so the reader spent
          their attention on bars that carried no signal. Folded into the four
          bands an admin can act on, the shape says what it always meant: a pile
          that never showed up, and a pile that lives in the product.

          Horizontal, because these are counts of one thing against a shared
          baseline, and because the bar next to its name needs no axis. */}
      <div className="space-y-2.5">
        {bands.map((band, i) => {
          const n = band.seats.length;
          const share = licence.total > 0 ? Math.round((n / licence.total) * 100) : 0;
          return (
            <div key={band.label} title={n === 0 ? `${band.label}: nobody` : `${band.label}: ${band.seats.map(s => s.name).join(', ')}`}>
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className={`text-[0.75rem] truncate min-w-0 ${band.attention && n > 0 ? 'font-semibold text-ink-900' : 'font-medium text-ink-700'}`}>
                  {band.label}
                </span>
                <span className="text-[0.6875rem] tabular-nums shrink-0 text-ink-400">
                  <span className={`font-semibold ${n === 0 ? 'text-ink-300' : 'text-ink-800'}`}>{n}</span>
                  <span> {n === 1 ? 'seat' : 'seats'}</span>
                  {n > 0 && <span className="ml-1.5 text-ink-300">{share}%</span>}
                </span>
              </div>
              <div className="h-2 rounded-full bg-ink-900/[0.06] overflow-hidden">
                {n > 0 && (
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: band.attention ? ATTENTION : BRAND }}
                    initial={prefersReduced ? false : { width: 0 }}
                    animate={{ width: `${Math.max(2, (n / bandMax) * 100)}%` }}
                    transition={prefersReduced ? { duration: 0 } : { duration: 0.5, delay: 0.05 * i, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
              </div>
            </div>
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
  const prefersReduced = useReducedMotion();
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
      <div className="space-y-2.5">
        {ranked.map((p, i) => {
          const isShelf = p.quadrant === 'shelfware';
          return (
            <div key={p.module}>
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className={`text-[0.75rem] truncate min-w-0 ${isShelf ? 'font-semibold text-ink-900' : 'font-medium text-ink-700'}`}>
                  {p.module}
                </span>
                <span className="text-[0.6875rem] tabular-nums shrink-0 text-ink-400">
                  <span className="font-semibold text-ink-800">{p.users}</span>
                  <span> of {users.length} seats</span>
                  <span className="mx-1.5 text-ink-300">|</span>
                  <span className="font-semibold text-ink-800">{p.frequency}</span>
                  <span> each</span>
                </span>
              </div>
              {/* One track width for every row, so the bars share a baseline and
                  the ranking is legible at a glance. */}
              <div className="h-2 rounded-full bg-ink-900/[0.06] overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: isShelf ? ATTENTION : BRAND }}
                  initial={prefersReduced ? false : { width: 0 }}
                  animate={{ width: `${Math.max(2, p.breadth)}%` }}
                  transition={prefersReduced ? { duration: 0 } : { duration: 0.5, delay: 0.03 * i, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </div>
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
