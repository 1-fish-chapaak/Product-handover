import { useEffect, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { KpiTile } from '../shared/KpiTile';
import { renderAssistantText } from '../shared/AssistantMarkdown';
import { sanitizePartialMarkdown } from './reveal/sanitizePartialMarkdown';
import { useTypewriter } from './reveal/useTypewriter';

// ── Reveal choreography ──────────────────────────────────────────────────────
// Prose leads and is meant to be *watched*. The compact KPI grid brews
// alongside it (it sits directly under the text, so it reads as "here come the
// numbers" without stealing the reader). The heavy artifacts — the chart and
// the row-streamed table — hold until the typewriter has finished, so they
// never yank focus mid-sentence, then stagger between themselves so the tail
// feels like a sequence settling rather than a dump.
const KPI_ONSET = 350;         // ms from mount — KPI grid, while prose types
const TABLE_AFTER_PROSE = 180; // ms after prose completes — table starts
const CHART_AFTER_PROSE = 520; // ms after prose completes — chart draws in
const ROW_INTERVAL = 80;       // ms between streamed table rows

interface AuditResultBodyProps {
  /** Re-keys the reveal so a fresh result replays from the top. */
  messageId: string;
  text: string;
  kpis: { label: string; value: string }[];
  /** Rendered between prose and KPIs (e.g. the "open Workspace" link). */
  afterProse?: ReactNode;
  /** Real chart card. Mounted only after the prose finishes so it draws in fresh. */
  renderChart: () => ReactNode;
  /** Real results table, sliced to the number of rows revealed so far. */
  renderTable: (revealedRows: number) => ReactNode;
  /** How many rows the table previews — the row-stream target. */
  previewRowCount: number;
  /** Snap straight to the finished state (generation stopped). */
  forceComplete?: boolean;
}

// ── Skeletons — sized to the real cards so there is zero layout shift when the
//    content swaps in. `skeleton-cool` is the shared neutral shimmer. ──
function KpiSkeletonGrid({ count }: { count: number }) {
  return (
    <div aria-hidden className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-card rounded-xl px-5 py-4">
          <div className="skeleton-cool h-2.5 w-2/3 rounded mb-3" />
          <div className="skeleton-cool h-6 w-1/2 rounded" />
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div aria-hidden className="rounded-2xl border border-canvas-border bg-canvas-elevated overflow-hidden" style={{ height: 440 }}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-canvas-border/70">
        <div className="skeleton-cool h-3 w-40 rounded" />
        <div className="skeleton-cool h-7 w-24 rounded-lg" />
      </div>
      {/* Plot area: a ghost baseline + a few rising bars so the shape reads as
          "a chart is rendering", not a blank panel. */}
      <div className="flex items-end gap-4 px-8 pt-8" style={{ height: 360 }}>
        {[0.55, 0.8, 0.72, 0.95].map((h, i) => (
          <div key={i} className="skeleton-cool flex-1 rounded-t-md" style={{ height: `${h * 100}%` }} />
        ))}
      </div>
    </div>
  );
}

function TableSkeleton({ columns }: { columns: number }) {
  return (
    <div aria-hidden className="rounded-2xl border border-canvas-border bg-canvas-elevated overflow-hidden" style={{ height: 440 }}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-canvas-border/70">
        <div className="skeleton-cool h-3 w-44 rounded" />
        <div className="skeleton-cool h-7 w-24 rounded-lg" />
      </div>
      <div className="px-5 py-3">
        {Array.from({ length: 7 }).map((_, r) => (
          <div key={r} className="flex gap-4 py-2.5">
            {Array.from({ length: Math.min(columns, 6) }).map((_, c) => (
              <div key={c} className="skeleton-cool h-3 flex-1 rounded" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AuditResultBody({
  messageId,
  text,
  kpis,
  afterProse,
  renderChart,
  renderTable,
  previewRowCount,
  forceComplete = false,
}: AuditResultBodyProps) {
  const prefersReducedMotion = useReducedMotion();
  const instant = !!prefersReducedMotion || forceComplete;

  // Animated onsets start false and are flipped only from timer callbacks. The
  // `instant` case is OR'd in at render time, so the effect never sets state
  // synchronously (and no skeleton ever flashes under reduced motion).
  const [kpiOn, setKpiOn] = useState(false);
  const [tableOn, setTableOn] = useState(false);
  const [chartOn, setChartOn] = useState(false);
  const [tableRows, setTableRows] = useState(0);

  const { shown, done } = useTypewriter(text, { enabled: !instant });

  // KPI scoreboard brews alongside the prose.
  useEffect(() => {
    if (instant) return;
    const t = setTimeout(() => setKpiOn(true), KPI_ONSET);
    return () => clearTimeout(t);
  }, [messageId, instant]);

  // Heavy artifacts wait for the typewriter to land, then stagger in.
  useEffect(() => {
    if (instant || !done) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => {
      setTableOn(true);
      // Stream rows one at a time until the preview is full.
      let r = 0;
      const streamRow = () => {
        r += 1;
        setTableRows(r);
        if (r < previewRowCount) timers.push(setTimeout(streamRow, ROW_INTERVAL));
      };
      streamRow();
    }, TABLE_AFTER_PROSE));
    timers.push(setTimeout(() => setChartOn(true), CHART_AFTER_PROSE));
    return () => { timers.forEach(clearTimeout); };
  }, [messageId, instant, done, previewRowCount]);

  const proseSource = instant ? text : shown;
  const showCaret = !instant && !done && !!text;

  const showKpi = instant || kpiOn;
  const showTable = instant || tableOn;
  const showChart = instant || chartOn;
  const rowsToShow = instant ? previewRowCount : tableRows;

  return (
    <div className="space-y-4 w-full">
      {/* Prose — streamed char-by-char, markdown kept stable each frame. The
          caret is a glyph appended into the source (before sanitising) so it
          tracks the last character inline instead of dropping below the block
          paragraph, and never reflows the trailing word as it would if toggled. */}
      {text && (
        <div className="text-[0.9375rem] leading-[1.65] text-ink-800 max-w-[66ch]">
          {renderAssistantText(sanitizePartialMarkdown(proseSource + (showCaret ? '▌' : '')))}
        </div>
      )}

      {afterProse}

      {/* KPI scoreboard — tiles carry their own count-up + cascade on mount. */}
      {showKpi ? (
        <motion.div
          initial={instant ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          role="list"
          aria-label="Key results"
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {kpis.map((kpi, ki) => (
            <KpiTile key={kpi.label} label={kpi.label} value={kpi.value} index={ki} />
          ))}
        </motion.div>
      ) : (
        <KpiSkeletonGrid count={kpis.length} />
      )}

      {/* Chart — mounted fresh at its onset so recharts draws in; we crossfade
          the whole card rather than touch the shared ConfigurableChart. */}
      {showChart ? (
        <motion.div
          initial={instant ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 240, damping: 26 }}
        >
          {renderChart()}
        </motion.div>
      ) : (
        <ChartSkeleton />
      )}

      {/* Table — header is the schema, rows stream in; the card's fixed height
          means the body fills without any reflow. */}
      {showTable ? renderTable(rowsToShow) : <TableSkeleton columns={10} />}
    </div>
  );
}
