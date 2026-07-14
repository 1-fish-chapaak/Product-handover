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
import { CARD } from './usageSectionPrimitives';

/* Sequential ramp — one hue, light → dark. Magnitude, not identity. */
const RAMP = ['#EDE4FA', '#DCC9F5', '#C4A2EE', '#A87BE4', '#8B4FD8', '#7628CF', '#6A12CD'];
/* The one colour that carries an action. Validated against the brand at
 * ΔE 136.6 (protan) — see the dataviz palette check. */
const ATTENTION = '#D97706';
const BRAND = '#6A12CD';

function Panel({ icon: Icon, title, subtitle, children, className = '' }: {
  icon: typeof Gauge;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`${CARD} overflow-hidden flex flex-col ${className}`}>
      <div className="flex items-center gap-2 px-5 py-3 border-b border-canvas-border/60 shrink-0">
        <Icon size={14} className="text-ink-500 shrink-0" strokeWidth={1.75} />
        <h3 className="text-[0.75rem] font-semibold text-ink-900">{title}</h3>
        <span className="hidden md:inline text-[0.6875rem] text-ink-400 truncate">· {subtitle}</span>
      </div>
      <div className="flex-1 p-5">{children}</div>
    </div>
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
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[1.625rem] font-semibold text-ink-900 tabular-nums leading-none">
          {licence.pct}%
        </span>
        <span className="text-[0.75rem] text-ink-500">
          of {licence.total} seats did real work
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-brand-50 overflow-hidden mb-5">
        <motion.div
          className="h-full rounded-full bg-brand-600"
          initial={prefersReduced ? false : { width: 0 }}
          animate={{ width: `${Math.max(2, licence.pct)}%` }}
          transition={{ duration: prefersReduced ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      <div className="flex items-end justify-between gap-2 h-[132px]">
        {curve.buckets.map((b, i) => {
          const n = b.seats.length;
          const heightPct = (n / max) * 100;
          const names = b.seats.map(s => s.name).join(', ');
          return (
            <div key={b.label} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full">
              <span className={`text-[0.6875rem] tabular-nums font-semibold ${n === 0 ? 'text-ink-300' : 'text-ink-800'}`}>
                {n}
              </span>
              <motion.div
                title={n === 0
                  ? `${b.label} days: nobody`
                  : `${b.label} days of work: ${n} seat${n === 1 ? '' : 's'} — ${names}`}
                initial={prefersReduced ? false : { height: 0 }}
                animate={{ height: `${Math.max(1.5, heightPct)}%` }}
                transition={prefersReduced ? { duration: 0 } : { duration: 0.5, delay: 0.05 * i, ease: [0.22, 1, 0.36, 1] }}
                className="w-full rounded-t-xs cursor-default"
                style={{ background: RAMP[i], minHeight: 2 }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2 mt-1.5">
        {curve.buckets.map(b => (
          <span key={b.label} className="flex-1 text-center text-[0.625rem] text-ink-400 tabular-nums">{b.label}</span>
        ))}
      </div>
      <p className="mt-1 text-[0.625rem] text-ink-400 text-center">Days active</p>

      {/* The two ends of the curve are the only two things to act on. */}
      <div className="mt-4 pt-4 border-t border-canvas-border/60 grid grid-cols-2 gap-4">
        <div>
          <div className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-2">
            Earning the licence
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[1.125rem] font-semibold text-ink-900 tabular-nums">{curve.committed.length}</span>
            <span className="text-[0.6875rem] text-ink-500">seats, half the period or more</span>
          </div>
          <div className="flex items-center mt-2">
            {curve.committed.slice(0, 6).map((p, i) => (
              <div key={p.email} className={i > 0 ? '-ml-1.5' : ''} title={p.name}>
                <InitialsAvatar name={p.name} size={22} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[0.6875rem] font-semibold text-mitigated-700 uppercase tracking-[0.14em] mb-2">
            Reclaim or retrain
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[1.125rem] font-semibold text-ink-900 tabular-nums">{curve.reclaim.length}</span>
            <span className="text-[0.6875rem] text-ink-500">seats, one day or none</span>
          </div>
          <div className="flex items-center mt-2">
            {curve.reclaim.slice(0, 6).map((p, i) => (
              <div key={p.email} className={i > 0 ? '-ml-1.5' : ''} title={p.name}>
                <InitialsAvatar name={p.name} size={22} />
              </div>
            ))}
            {curve.reclaim.length === 0 && <span className="text-[0.6875rem] text-ink-400">Nobody — every seat is in use.</span>}
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ── The engagement matrix ────────────────────────────────────────────────── */

function MatrixPanel({ days, users }: { days: UsageDay[]; users: AdminUser[] }) {
  const prefersReduced = useReducedMotion();
  const { points, breadthMid, frequencyMid } = useMemo(() => engagementMatrix(days, users), [days, users]);
  const [hover, setHover] = useState<MatrixPoint | null>(null);

  const maxFreq = Math.max(1, ...points.map(p => p.frequency));
  const shelfware = points.filter(p => p.quadrant === 'shelfware');

  // Plot area in %, with room for the axis labels.
  const x = (p: MatrixPoint) => (p.breadth / 100) * 100;
  const y = (p: MatrixPoint) => 100 - (p.frequency / (maxFreq * 1.12)) * 100;
  const midX = breadthMid;
  const midY = 100 - (frequencyMid / (maxFreq * 1.12)) * 100;

  /** Push overlapping labels apart. Dots stay put — only the text moves. */
  const labelled = useMemo(() => {
    const MIN_GAP = 5.5; // % of plot height ≈ one line of 10px text
    const byRow = points
      .map(p => ({ p, xPct: x(p), top: y(p) }))
      .sort((a, b) => a.top - b.top);
    // Only labels that share roughly the same column can actually collide.
    for (let i = 1; i < byRow.length; i++) {
      const cur = byRow[i];
      const prev = byRow[i - 1];
      const sameColumn = Math.abs(cur.xPct - prev.xPct) < 12;
      if (sameColumn && cur.top - prev.top < MIN_GAP) cur.top = prev.top + MIN_GAP;
    }
    return byRow;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, maxFreq]);

  return (
    <Panel
      icon={Grid2x2}
      title="Which areas earn their keep"
      subtitle="How many use it × how hard they lean on it"
    >
      <div className="relative w-full h-[280px] rounded-md border border-canvas-border/60 bg-canvas/40 overflow-visible">
        {/* Quadrant split — recessive, it's chrome not data. */}
        <div className="absolute inset-y-0 border-l border-dashed border-canvas-border" style={{ left: `${midX}%` }} />
        <div className="absolute inset-x-0 border-t border-dashed border-canvas-border" style={{ top: `${midY}%` }} />

        {/* Quadrant names, corner-anchored so they never sit under a dot. */}
        <span className="absolute top-1.5 right-2 text-[0.5625rem] font-semibold uppercase tracking-wider text-ink-300">Core</span>
        <span className="absolute top-1.5 left-2 text-[0.5625rem] font-semibold uppercase tracking-wider text-ink-300">Power</span>
        <span className="absolute bottom-1.5 right-2 text-[0.5625rem] font-semibold uppercase tracking-wider text-ink-300">Set-up</span>
        <span className="absolute bottom-1.5 left-2 text-[0.5625rem] font-semibold uppercase tracking-wider" style={{ color: ATTENTION }}>Shelfware</span>

        {points.map((p, i) => {
          const isShelf = p.quadrant === 'shelfware';
          const active = hover?.module === p.module;
          return (
            <motion.button
              key={p.module}
              type="button"
              onMouseEnter={() => setHover(p)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(p)}
              onBlur={() => setHover(null)}
              initial={prefersReduced ? false : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={prefersReduced ? { duration: 0 } : { duration: 0.35, delay: 0.03 * i, ease: [0.22, 1, 0.36, 1] }}
              // Generous hit area around a small mark, per the interaction spec.
              className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-full cursor-default focus:outline-none"
              style={{ left: `${x(p)}%`, top: `${y(p)}%` }}
              aria-label={`${p.module}: used by ${p.users} of ${users.length} seats, ${p.frequency} actions each. ${QUADRANT_LABEL[p.quadrant]}`}
            >
              <span
                className="block rounded-full ring-2 ring-canvas-elevated transition-transform"
                style={{
                  width: active ? 13 : 10,
                  height: active ? 13 : 10,
                  background: isShelf ? ATTENTION : BRAND,
                }}
              />
            </motion.button>
          );
        })}

        {/* Direct labels — identity comes from the name, never from a 12th hue.
            Two modules can land on nearly the same spot (Knowledge Hub and
            Dashboards differ by half an action), so labels are nudged apart
            before they're drawn: a label sitting on top of another one names
            neither. */}
        {labelled.map(({ p, top }) => (
          <span
            key={`${p.module}-label`}
            className={`absolute -translate-y-1/2 ml-3 text-[0.625rem] whitespace-nowrap pointer-events-none transition-colors ${
              hover && hover.module !== p.module ? 'text-ink-300' : 'text-ink-600'
            }`}
            style={{ left: `${x(p)}%`, top: `${top}%` }}
          >
            {p.module}
          </span>
        ))}
      </div>

      {/* Axes */}
      <div className="flex items-center justify-between mt-1.5 text-[0.625rem] text-ink-400">
        <span>Few people use it</span>
        <span className="font-medium text-ink-500">Share of seats that used it →</span>
        <span>Everyone uses it</span>
      </div>

      <div className="mt-4 pt-4 border-t border-canvas-border/60">
        {hover ? (
          <p className="text-[0.75rem] text-ink-700 leading-snug">
            <span className="font-semibold text-ink-900">{hover.module}</span> — used by{' '}
            <span className="font-semibold text-ink-900">{hover.users} of {users.length} seats</span>, about{' '}
            <span className="font-semibold text-ink-900">{hover.frequency}</span> actions each.{' '}
            {QUADRANT_LABEL[hover.quadrant]}.
          </p>
        ) : shelfware.length > 0 ? (
          <p className="text-[0.75rem] text-ink-700 leading-snug flex items-start gap-2">
            <Info size={13} className="mt-0.5 shrink-0" style={{ color: ATTENTION }} />
            <span>
              <span className="font-semibold text-ink-900">{shelfware.map(p => p.module).join(', ')}</span>{' '}
              {shelfware.length === 1 ? 'is' : 'are'} used by few people and used lightly by those who do — the part of
              the platform to improve or drop. Hover any point for its numbers.
            </span>
          </p>
        ) : (
          <p className="text-[0.75rem] text-ink-700 leading-snug">
            Nothing is sitting on the shelf — every area is used either broadly or deeply. Hover any point for its numbers.
          </p>
        )}
      </div>
    </Panel>
  );
}

export default function UsageAdoption({ days, users }: { days: UsageDay[]; users: AdminUser[] }) {
  return (
    <div className="mb-3">
      <div className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-2">Adoption</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <PowerCurvePanel days={days} users={users} />
        <MatrixPanel days={days} users={users} />
      </div>
    </div>
  );
}
