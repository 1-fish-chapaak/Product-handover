import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { KpiTile } from '../shared/KpiTile';
import { renderAssistantText } from '../shared/AssistantMarkdown';
import { sanitizePartialMarkdown } from './reveal/sanitizePartialMarkdown';
import { useTypewriter } from './reveal/useTypewriter';
import { useStream } from './stream/useStream';
import { useSmoothText } from './stream/useSmoothText';
import { mockAuditStream, type MockAuditData } from './stream/mockStream';

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
  /** Flag-gated streaming path: when present, the prose streams from this mock
   *  event stream (the spine) instead of the fixed-string typewriter. Absent =
   *  legacy behavior, untouched. */
  streamData?: MockAuditData;
  /** Fired once when the stream reaches its 'done' phase. */
  onDone?: () => void;
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

// Simple on/off blink for the streaming caret — a real blinking element rather
// than a static glyph (toggles a boolean on an interval).
function useBlink(intervalMs: number): boolean {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setOn(o => !o), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return on;
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
  streamData,
  onDone,
}: AuditResultBodyProps) {
  const prefersReducedMotion = useReducedMotion();
  const instant = !!prefersReducedMotion || forceComplete;
  const streaming = !!streamData;

  // Animated onsets start false and are flipped only from timer callbacks. The
  // `instant` case is OR'd in at render time, so the effect never sets state
  // synchronously (and no skeleton ever flashes under reduced motion).
  const [kpiOn, setKpiOn] = useState(false);
  const [tableOn, setTableOn] = useState(false);
  const [chartOn, setChartOn] = useState(false);
  const [tableRows, setTableRows] = useState(0);

  // ── Prose source ──────────────────────────────────────────────────────────
  // Streaming path: prose grows from text.delta events via the spine, smoothed
  // for display. Legacy path: fixed-string typewriter. Both hooks run every
  // render; the inactive one is inert (null source / disabled).
  const source = useMemo(
    () => (streamData && !instant ? mockAuditStream(streamData) : null),
    [streamData, instant],
  );
  const stream = useStream(source);
  const { shown: streamShown, done: streamCaught } = useSmoothText(stream.text, { reduced: instant });
  const { shown: typed, done: typedDone } = useTypewriter(text, { enabled: !instant && !streaming });

  const streamTextDone = stream.phase === 'materializing' || stream.phase === 'done';
  const done = instant ? true : streaming ? (streamCaught && streamTextDone) : typedDone;

  // Fire onDone exactly once when the stream completes.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const firedDone = useRef(false);
  useEffect(() => {
    if (streaming && stream.phase === 'done' && !firedDone.current) {
      firedDone.current = true;
      onDoneRef.current?.();
    }
  }, [streaming, stream.phase]);

  // KPI scoreboard brews on a fixed onset in legacy mode. In streaming mode the
  // grid is gated on the kpi block arriving (data-driven), so this timer is off.
  useEffect(() => {
    if (instant || streaming) return;
    const t = setTimeout(() => setKpiOn(true), KPI_ONSET);
    return () => clearTimeout(t);
  }, [messageId, instant, streaming]);

  // Heavy artifacts wait for the typewriter to land, then stagger in. Legacy
  // only — in streaming mode the chart/table are driven by their block events.
  useEffect(() => {
    if (instant || streaming || !done) return;
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
  }, [messageId, instant, streaming, done, previewRowCount]);

  const proseSource = instant ? text : streaming ? streamShown : typed;
  const showCaret = !instant && !done && (streaming ? stream.phase !== 'idle' : !!text);
  const blink = useBlink(530);
  const caretGlyph = showCaret && (streaming ? blink : true) ? '▌' : '';

  // Streaming blocks materialize from the spine's events (data-driven), not the
  // legacy onset timers: KPIs when the kpi block lands, table rows as the
  // table block's batches accumulate, chart when its block completes.
  const kpiBlock = stream.blocks.find(b => b.kind === 'kpi');
  const tableBlock = stream.blocks.find(b => b.kind === 'table');
  const chartBlock = stream.blocks.find(b => b.kind === 'chart');

  const showKpi = instant || (streaming ? !!kpiBlock : kpiOn);
  const showTable = instant || (streaming ? !!tableBlock : tableOn);
  const showChart = instant || (streaming ? chartBlock?.status === 'complete' : chartOn);
  const rowsToShow = instant
    ? previewRowCount
    : streaming
      ? Math.min(previewRowCount, tableBlock?.rows?.length ?? 0)
      : tableRows;

  return (
    <div className="space-y-4 w-full">
      {/* Reasoning trail — the brief "working" beat before the answer streams.
          Shown only in streaming mode while still reasoning; it gives way to the
          prose the moment the first answer token lands. */}
      {streaming && stream.phase === 'reasoning' && stream.reasoning.steps.length > 0 && (
        <div className="space-y-1" aria-label="Working">
          {stream.reasoning.steps.map(s => (
            <div key={s.id} className="flex items-center gap-2 text-[0.75rem] text-ink-500">
              <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'done' ? 'bg-brand-300' : 'bg-primary'}`} aria-hidden="true" />
              {s.label}{s.status === 'active' ? '…' : ''}
            </div>
          ))}
        </div>
      )}

      {/* Prose — streamed char-by-char, markdown kept stable each frame. The
          caret is a glyph appended into the source (before sanitising) so it
          tracks the last character inline instead of dropping below the block
          paragraph, and never reflows the trailing word as it would if toggled. */}
      {text && (
        <div className="text-[0.9375rem] leading-[1.65] text-ink-800 max-w-[66ch]">
          {renderAssistantText(sanitizePartialMarkdown(proseSource + caretGlyph))}
        </div>
      )}

      {/* Stream failure (defensive — the mock never errors, but the contract and
          UI handle it for the real source). */}
      {streaming && stream.phase === 'error' && (
        <div className="text-[0.8125rem] text-risk-700" role="alert">
          Couldn’t finish generating this result{stream.error ? ` — ${stream.error}` : ''}.
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
          means the body fills without any reflow. In streaming mode the rows are
          driven by the table block's batches, with a live count tracking
          arrival. */}
      {showTable ? (
        <div className="space-y-1.5">
          {streaming && tableBlock && tableBlock.status !== 'complete' && (
            <div className="text-[0.6875rem] text-ink-500 tabular-nums" aria-live="polite">
              Streaming rows… {rowsToShow}
            </div>
          )}
          {renderTable(rowsToShow)}
        </div>
      ) : <TableSkeleton columns={10} />}
    </div>
  );
}
