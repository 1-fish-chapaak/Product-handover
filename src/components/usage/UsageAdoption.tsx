/**
 * Adoption — the three questions a seat-licensed admin actually has.
 *
 * "Who is using this, is it worth the licence, what should I fix." The metrics
 * come from Amplitude's analytics model (power-user curve, engagement matrix,
 * licence utilisation); the reasoning behind each — and the one Amplitude metric
 * deliberately left out, DAU/MAU — is in platform-usage.ts.
 *
 * Chart choices, for the next person:
 *   · The curve is a histogram, so it gets ONE hue on a sequential ramp
 *     (light → dark as engagement rises). It is not a categorical palette: the
 *     buckets are an ordered scale, and colouring them by identity would imply
 *     they are unrelated categories.
 *   · The matrix plots a dozen modules. A dozen hues would be unreadable and is
 *     an anti-pattern, so identity comes from a direct label on every dot, and
 *     colour is reserved for the one thing that carries an action: the shelfware
 *     quadrant. Two hues, both validated for colour-blind separation.
 */

import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Gauge, Grid2x2, Info } from 'lucide-react';
import type { AdminUser } from '../../context/AdminDataContext';
import {
  powerCurve, engagementMatrix, licenceUse, QUADRANT_LABEL,
  type UsageDay, type MatrixPoint,
} from '../../data/platform-usage';
import { InitialsAvatar } from '../admin/AdminPrimitives';
import { Card, Eyebrow } from './usageChrome';
import { RAMP } from './usageTokens';

/* The one colour that carries an action. Validated against the brand at
 * ΔE 136.6 (protan) — see the dataviz palette check. */
const ATTENTION = '#B45309';
const BRAND = '#6A12CD';

/**
 * The curve's colours, bucket by bucket.
 *
 * The ramp ran light → dark as engagement rose, which put its palest step —
 * #EDE4FA, all but white on an elevated card — under the one bucket an admin is
 * here to act on: the seats that did nothing. The bucket carrying five idle
 * licences was the hardest bar on the page to see.
 *
 * So the idle column wears the attention tone (the same one the "Reclaim or
 * retrain" callout under it already uses — the two are the same fact, and now
 * they look it), and the working buckets take the ramp from its fourth step up,
 * where it has enough weight to read against the card.
 */
const curveColor = (index: number, total: number) =>
  index === 0 ? ATTENTION : RAMP[Math.min(RAMP.length - 1, 2 + index)] ?? RAMP[total - 1];

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

  const max = Math.max(1, ...curve.buckets.map(b => b.seats.length));

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

      {/* Ordered buckets, so the ramp is legitimate: it encodes "more days of
          work", not identity. Columns are capped and squared on a real baseline —
          without one, a zero bucket and a one-seat bucket were both "a faint line
          somewhere near the bottom". */}
      <div className="flex items-end justify-between gap-2 h-[140px] border-b border-canvas-border">
        {curve.buckets.map((b, i) => {
          const n = b.seats.length;
          const heightPct = (n / max) * 100;
          const names = b.seats.map(s => s.name).join(', ');
          return (
            <div
              key={b.label}
              className="group flex-1 flex flex-col items-center justify-end gap-1.5 h-full cursor-default"
              title={n === 0
                ? `${b.label} days: nobody`
                : `${b.label} days of work: ${n} seat${n === 1 ? '' : 's'} — ${names}`}
            >
              <span className={`text-[0.75rem] tabular-nums font-semibold ${n === 0 ? 'text-ink-300' : 'text-ink-900'}`}>
                {n}
              </span>
              {n === 0 ? (
                // An empty bucket is a fact, not a value. It gets the width of a
                // bar and the height of nothing, so the eye reads "none here"
                // rather than hunting for a bar it can't see.
                <div className="w-full max-w-[34px] h-[3px] rounded-t-xs bg-ink-900/[0.07]" />
              ) : (
                <motion.div
                  initial={prefersReduced ? false : { height: 0 }}
                  animate={{ height: `${Math.max(3, heightPct)}%` }}
                  transition={prefersReduced ? { duration: 0 } : { duration: 0.5, delay: 0.05 * i, ease: [0.22, 1, 0.36, 1] }}
                  className="w-full max-w-[34px] rounded-t-xs transition-opacity group-hover:opacity-85"
                  style={{ background: curveColor(i, curve.buckets.length), minHeight: 3 }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2 mt-2">
        {curve.buckets.map((b, i) => (
          <span
            key={b.label}
            className={`flex-1 text-center text-[0.625rem] tabular-nums ${i === 0 ? 'font-semibold' : 'text-ink-400'}`}
            style={i === 0 ? { color: ATTENTION } : undefined}
          >
            {b.label}
          </span>
        ))}
      </div>
      <p className="mt-1.5 text-[0.625rem] text-ink-400 text-center">
        Days active in the window · each bar is a count of seats
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
