/**
 * Platform Usage — the engagement matrix (PRD REQ-5.5–5.8).
 *
 * Every area of the product placed on two axes: how many people use it (breadth,
 * as a share of paid seats) against how hard they use it (frequency, events per
 * user who touched it). Amplitude's Engagement Matrix, and the reason it is the
 * only chart on this page with two axes is that it is the only question on this
 * page with two dimensions.
 *
 * WHY THIS IS NOT A BAR. It was one, and the argument for the bar was that a
 * reader shouldn't have to decode two axes and a quadrant convention to learn
 * "nobody opens Dashboards". That argument is right about bars and wrong about
 * this data, because the finding is not "Dashboards is last" — a ranking gives
 * you that. The finding is WHICH KIND of unused it is, and that is a position,
 * not a rank:
 *
 *   · Broad and shallow (Set-up) — everyone touches it once. Working as intended.
 *     Nothing to fix.
 *   · Narrow and deep (Power) — a few people live in it. That is a healthy
 *     specialist tool, not a failure.
 *   · Narrow and shallow (Shelfware) — few people, and lightly. THIS is the one
 *     you improve or drop.
 *
 * Set-up and Shelfware sort to almost the same place on a one-dimensional bar,
 * and the whole point of the exercise is that you must do opposite things about
 * them. Collapsing the second axis to a number printed on the row does not fix
 * that: it asks the reader to do the two-dimensional comparison in their head,
 * across twelve rows, which is precisely the work a scatter does for them.
 *
 * The axes split on the MEDIAN of the modules that actually exist, not on a fixed
 * threshold (see `engagementMatrix`), so every read is "compared to the rest of
 * this platform" — the only comparison that means anything without an industry
 * benchmark. Modules with no events are absent, not plotted at the origin, which
 * would drag both medians down and silently reclassify their neighbours.
 */

import { useMemo } from 'react';
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, ZAxis,
} from 'recharts';
import type { AdminUser } from '../../context/AdminDataContext';
import {
  engagementMatrix, QUADRANT_LABEL,
  type UsageDay, type MatrixPoint, type UsageModule,
} from '../../data/platform-usage';
import { TooltipCard } from './usageChrome';
import { GRID, SERIES, xAxisProps, yAxisProps } from './usageTokens';

/** A plotted module, plus where its label goes once collisions are resolved. */
interface PlacedPoint extends MatrixPoint {
  /** Offset from the dot, in px. The dot never moves; only its label does. */
  labelDx: number;
  labelDy: number;
  /** Which side of the offset the text is anchored from. */
  labelLeft: boolean;
}

/* The plot area this places labels against. It does not have to match the
   rendered size exactly — it only has to have the right ASPECT, because all it
   decides is the ORDER in which candidate slots are tried. Recharts does the
   real positioning; this just picks a side. */
const PLOT_W = 620;
const PLOT_H = 300;

/** A 10.5px label is about 5.8px per character, plus the halo. Close enough to
 *  reserve space with — the cost of being 10% wrong is a slightly cautious
 *  layout, not an overlap. */
const charW = 5.8;
const LINE_H = 12;

interface Rect { x: number; y: number; w: number; h: number }

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * Label de-collision.
 *
 * Twelve modules in one plot WILL collide — the areas a team actually uses
 * cluster, which is the whole reason the cluster is worth drawing. The previous
 * scatter was retired partly because this took "~100 lines of collision code".
 * It takes about thirty, and it is the thirty that make the chart readable.
 *
 * For each point, try a ring of candidate slots (right of the dot first, then
 * left, then above and below) and take the first that hits neither a label
 * already placed nor any dot. Busiest points go first — the ones a reader most
 * needs to identify get the best slot rather than whatever is left.
 */
function place(points: MatrixPoint[], maxFreq: number, yMax: number): PlacedPoint[] {
  const px = (p: MatrixPoint) => (p.breadth / 100) * PLOT_W;
  const py = (p: MatrixPoint) => PLOT_H - (yMax > 0 ? p.frequency / yMax : 0) * PLOT_H;

  // Every dot is an obstacle, including those not yet labelled — a label must not
  // land on a dot it does not belong to.
  const dots: Rect[] = points.map(p => ({ x: px(p) - 7, y: py(p) - 7, w: 14, h: 14 }));

  /* Candidate slots, in preference order: beside the dot, then diagonally, then
     above/below. `left` flips the text anchor so it grows away from the dot. */
  const SLOTS: { dx: number; dy: number; left: boolean }[] = [
    { dx: 9, dy: 0, left: false },
    { dx: -9, dy: 0, left: true },
    { dx: 9, dy: -LINE_H, left: false },
    { dx: -9, dy: -LINE_H, left: true },
    { dx: 9, dy: LINE_H, left: false },
    { dx: -9, dy: LINE_H, left: true },
    { dx: 0, dy: -LINE_H - 4, left: false },
    { dx: 0, dy: LINE_H + 6, left: false },
    { dx: 9, dy: -LINE_H * 2, left: false },
    { dx: -9, dy: -LINE_H * 2, left: true },
  ];

  const taken: Rect[] = [];
  const placed: PlacedPoint[] = [];

  [...points]
    // Most-used first: they earn the uncontested slot.
    .sort((a, b) => b.users - a.users || b.frequency - a.frequency)
    .forEach(p => {
      const w = p.module.length * charW + 4;
      const x0 = px(p);
      const y0 = py(p);

      const fits = SLOTS.find(s => {
        const rect: Rect = {
          x: s.left ? x0 + s.dx - w : x0 + s.dx,
          y: y0 + s.dy - LINE_H / 2,
          w,
          h: LINE_H,
        };
        // Inside the plot, clear of every placed label, and clear of every dot.
        if (rect.x < -8 || rect.x + rect.w > PLOT_W + 8) return false;
        if (rect.y < -6 || rect.y + rect.h > PLOT_H + 6) return false;
        if (taken.some(t => overlaps(rect, t))) return false;
        return !dots.some(d => overlaps(rect, d));
      }) ?? SLOTS[0];

      taken.push({
        x: fits.left ? x0 + fits.dx - w : x0 + fits.dx,
        y: y0 + fits.dy - LINE_H / 2,
        w,
        h: LINE_H,
      });
      placed.push({ ...p, labelDx: fits.dx, labelDy: fits.dy, labelLeft: fits.left });
    });

  return placed;
}

/** The dot, and its label. One custom shape, so the two can never drift apart. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Dot({ cx, cy, payload, onSelect }: any) {
  const p = payload as PlacedPoint;
  if (typeof cx !== 'number' || typeof cy !== 'number') return null;
  const shelf = p.quadrant === 'shelfware';
  const color = shelf ? SERIES.attention : SERIES.primary;

  return (
    <g
      onClick={onSelect ? () => onSelect(p.module) : undefined}
      style={onSelect ? { cursor: 'pointer' } : undefined}
      role={onSelect ? 'button' : undefined}
      /* NOT "— open details". That exact suffix is how _qa-usage-modals and
         _qa-usage-consistency find the twelve section TILES
         (`button[aria-label$="open details"]`), and a dozen SVG <g> nodes
         answering to the same name made the tile selector resolve to a point on a
         chart that cannot be clicked like a card. The dots open the same detail;
         they just must not answer to the tiles' name. */
      aria-label={onSelect ? `${p.module}, ${QUADRANT_LABEL[p.quadrant]}, open this area` : undefined}
    >
      {/* An invisible hit area. A 5px dot is well under the 24px minimum target,
          and the whole point of the chart is that you can go from "what is that
          dot in the bottom-left" to the answer without hunting for it in a grid
          of twelve cards below. */}
      {onSelect && <circle cx={cx} cy={cy} r={14} fill="transparent" />}
      {/* A halo in the surface colour, so a dot that lands on a median line or on
          a neighbour still reads as one mark. Same job the surface gap does
          between touching bars. */}
      <circle cx={cx} cy={cy} r={6.5} fill="#FFFFFF" />
      <circle cx={cx} cy={cy} r={5} fill={color} fillOpacity={shelf ? 1 : 0.9} />
      <text
        x={cx + p.labelDx}
        y={cy + p.labelDy}
        textAnchor={p.labelLeft ? 'end' : p.labelDx === 0 ? 'middle' : 'start'}
        dominantBaseline="middle"
        className="pointer-events-none"
        style={{
          fontSize: 10.5,
          fontWeight: shelf ? 600 : 500,
          fill: shelf ? SERIES.attention : '#5C5170',
          paintOrder: 'stroke',
          stroke: '#FFFFFF',
          strokeWidth: 3,
          strokeLinejoin: 'round',
        }}
      >
        {p.module}
      </text>
    </g>
  );
}

export default function UsageMatrix({ days, users, onSelect }: {
  days: UsageDay[];
  users: AdminUser[];
  /** Open an area's detail. Given, the dots become the map into the cards below. */
  onSelect?: (module: UsageModule) => void;
}) {
  const { points, breadthMid, frequencyMid } = useMemo(
    () => engagementMatrix(days, users),
    [days, users],
  );

  const maxFreq = Math.max(1, ...points.map(p => p.frequency));
  // Headroom on both axes, so a dot never sits on the frame and a label never
  // prints outside the plot.
  const xMax = 100;
  const yMax = Math.ceil(maxFreq * 1.25);
  const placed = useMemo(() => place(points, maxFreq, yMax), [points, maxFreq, yMax]);
  const shelfware = points.filter(p => p.quadrant === 'shelfware');

  if (points.length === 0) {
    return <p className="text-[0.8125rem] text-ink-400">No area was used in this period.</p>;
  }

  return (
    <div>
      <div className="h-[330px] -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 16, right: 20, left: 4, bottom: 20 }}>
            <CartesianGrid stroke={GRID} />

            {/* The shelfware box, tinted. It is the one quadrant that carries an
                action, and a reader should be able to find it without reading a
                single axis label — which is exactly what the bar version could
                not do. The other three quadrants stay untinted: they are all
                healthy in their own way, and colouring them would imply a ranking
                across four things that are not on one scale. */}
            <ReferenceArea
              x1={0} x2={breadthMid} y1={0} y2={frequencyMid}
              fill={SERIES.attention}
              fillOpacity={0.05}
              strokeOpacity={0}
            />

            {/* Both axes name their unit under the ticks, not inside the plot.
                An axis title set `insideBottomRight` lands in the data area and
                collides with whatever dot is nearest the corner — which on this
                chart is the most-adopted module on the platform, the one label a
                reader most wants. */}
            <XAxis
              type="number"
              dataKey="breadth"
              domain={[0, xMax]}
              {...xAxisProps}
              tickFormatter={(v: number) => `${v}%`}
              label={{
                value: 'Share of people who used it  →',
                position: 'insideBottom',
                offset: -14,
                style: { fontSize: 10, fill: '#9A8FAE', textAnchor: 'middle' },
              }}
            />
            <YAxis
              type="number"
              dataKey="frequency"
              domain={[0, yMax]}
              {...yAxisProps}
              width={46}
              label={{
                value: 'Actions per person  →',
                angle: -90,
                position: 'insideLeft',
                offset: 12,
                style: { fontSize: 10, fill: '#9A8FAE', textAnchor: 'middle' },
              }}
            />
            {/* Fixed dot size: the two axes already carry the two variables, and a
                third encoding on the radius would be a dimension the reader has no
                scale for. */}
            <ZAxis range={[64, 64]} />

            {/* The median crosshairs. Dashed, because they ARE thresholds — the
                one place on this page a dashed line is the honest mark. */}
            <ReferenceLine
              x={breadthMid}
              stroke="rgba(15,7,32,0.22)"
              strokeDasharray="4 4"
            />
            <ReferenceLine
              y={frequencyMid}
              stroke="rgba(15,7,32,0.22)"
              strokeDasharray="4 4"
            />

            <Tooltip
              isAnimationActive={false}
              cursor={{ strokeDasharray: '4 4', stroke: 'rgba(15,7,32,0.16)' }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as PlacedPoint;
                return (
                  <TooltipCard
                    title={p.module}
                    rows={[
                      { color: SERIES.primary, name: 'People who used it', value: p.users },
                      { color: SERIES.secondary, name: 'Actions per person', value: p.frequency },
                    ]}
                    footer={
                      <>
                        {p.breadth}% of {users.length} seats · {QUADRANT_LABEL[p.quadrant]}
                      </>
                    }
                  />
                );
              }}
            />

            <Scatter data={placed} shape={<Dot onSelect={onSelect} />} isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* What the four boxes mean, in the order you read them. Without this the
          plot is a cloud of dots. The names are plain now: the reader is an audit
          lead, and "shelfware" is the most important box on the chart. */}
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[0.6875rem] text-ink-500">
        <span><span className="font-semibold text-ink-700">Everyday</span>: most people, heavy use</span>
        <span><span className="font-semibold text-ink-700">Specialist</span>: few people, heavy use</span>
        <span><span className="font-semibold text-ink-700">Set up once</span>: most people, touched once</span>
        <span>
          <span className="font-semibold" style={{ color: SERIES.attention }}>Barely used</span>
          <span className="text-ink-500">: few people, and not much</span>
        </span>
      </div>

      <div className="mt-4 pt-3 border-t border-canvas-border">
        {shelfware.length > 0 ? (
          <p className="text-[0.75rem] text-ink-700 leading-snug">
            <span className="font-semibold text-ink-900">{shelfware.map(p => p.module).join(', ')}</span>{' '}
            {shelfware.length === 1 ? 'is' : 'are'} barely used. Few people go there, and the ones who do are not
            doing much. Worth asking whether the team needs {shelfware.length === 1 ? 'it' : 'them'}.
          </p>
        ) : (
          <p className="text-[0.75rem] text-ink-700 leading-snug">
            Every area is being used, either by a lot of people or heavily by a few.
          </p>
        )}
      </div>
    </div>
  );
}
