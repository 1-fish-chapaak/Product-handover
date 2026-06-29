// Event-driven streaming contract for the chat surfaces (text, graph, table).
//
// This is the spine that replaces the timer-driven "performed" reveal: every
// surface subscribes to ONE event stream and reacts to data arriving, not to a
// clock. The shape is a flat tagged union (SSE-friendly) so the same events
// could be produced by a real backend later. The mock emitter lives in
// ./mockStream; the reducer + hook in ./useStream.

/** High-level lifecycle the UI renders against. */
export type StreamPhase =
  | 'idle'          // nothing in flight
  | 'reasoning'     // "thinking" — reasoning steps/trail streaming
  | 'answering'     // prose answer streaming (text.delta)
  | 'materializing' // rich blocks (kpi/chart/table) arriving, possibly concurrent
  | 'done'          // completed cleanly
  | 'stopped'       // user aborted
  | 'error';        // stream failed

export type BlockKind = 'kpi' | 'chart' | 'table';

/** A reasoning step in the "working" trail (plan -> SQL -> sources -> ...). */
export interface ReasoningStep {
  id: string;
  label: string;
  status: 'active' | 'done';
}

export interface KpiDatum {
  label: string;
  value: string;
  color?: string;
}

/** Chart payload kept intentionally loose for now — the graph surface owns the
 *  concrete shape. `id` is required so blocks can be addressed by id. */
export interface ChartDatum {
  id: string;
  [key: string]: unknown;
}

export type TableRow = (string | number)[];

/** Incremental payload carried by `block.delta`, discriminated by block kind. */
export type BlockDelta =
  | { kind: 'kpi'; kpis: KpiDatum[] }
  | { kind: 'chart'; chart: ChartDatum }
  | { kind: 'table'; columns?: string[]; rows?: TableRow[] };

/** Everything the stream can emit. Flat, serializable, SSE-friendly. */
export type StreamEvent =
  | { type: 'reasoning.step'; step: ReasoningStep }
  | { type: 'reasoning.delta'; text: string }
  | { type: 'text.delta'; text: string }
  | { type: 'block.start'; id: string; kind: BlockKind }
  | { type: 'block.delta'; id: string; payload: BlockDelta }
  | { type: 'block.end'; id: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

/** A source produces a stream of events and honors an AbortSignal (stop). */
export type StreamSource = (signal: AbortSignal) => AsyncIterable<StreamEvent>;

/** A materialized rich block, accumulated from block.* events. */
export interface StreamBlock {
  id: string;
  kind: BlockKind;
  status: 'streaming' | 'complete';
  kpis?: KpiDatum[];
  chart?: ChartDatum;
  columns?: string[];
  rows?: TableRow[];
}

/** Render-ready state the reducer produces for the UI. */
export interface StreamState {
  phase: StreamPhase;
  reasoning: { steps: ReasoningStep[]; text: string };
  text: string;          // accumulated answer prose
  blocks: StreamBlock[]; // in arrival order
  error: string | null;
}
