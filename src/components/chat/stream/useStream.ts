import { useEffect, useReducer, useRef } from 'react';
import type {
  StreamEvent, StreamState, StreamSource, StreamBlock, BlockDelta,
} from './streamTypes';

// The reducer + hook that turn a StreamSource's events into render-ready state.
// This is the single subscription point all three surfaces (text/graph/table)
// read from — replacing the per-surface setTimeout choreography.

/** Stream events plus the two local control actions the hook dispatches. */
export type StreamAction = StreamEvent | { type: 'reset' } | { type: 'stopped' };

export const initialStreamState: StreamState = {
  phase: 'idle',
  reasoning: { steps: [], text: '' },
  text: '',
  blocks: [],
  error: null,
};

function applyBlockDelta(block: StreamBlock, payload: BlockDelta): StreamBlock {
  switch (payload.kind) {
    case 'kpi':
      return { ...block, kpis: payload.kpis };
    case 'chart':
      return { ...block, chart: payload.chart };
    case 'table':
      return {
        ...block,
        columns: payload.columns ?? block.columns,
        // Rows arrive in batches and accumulate.
        rows: payload.rows ? [...(block.rows ?? []), ...payload.rows] : block.rows,
      };
    default:
      return block;
  }
}

export function streamReducer(state: StreamState, action: StreamAction): StreamState {
  switch (action.type) {
    case 'reset':
      return initialStreamState;
    case 'stopped':
      return { ...state, phase: 'stopped' };
    case 'reasoning.step': {
      const exists = state.reasoning.steps.some(s => s.id === action.step.id);
      const steps = exists
        ? state.reasoning.steps.map(s => (s.id === action.step.id ? action.step : s))
        : [...state.reasoning.steps, action.step];
      return { ...state, phase: 'reasoning', reasoning: { ...state.reasoning, steps } };
    }
    case 'reasoning.delta':
      return {
        ...state,
        phase: 'reasoning',
        reasoning: { ...state.reasoning, text: state.reasoning.text + action.text },
      };
    case 'text.delta':
      return { ...state, phase: 'answering', text: state.text + action.text };
    case 'block.start': {
      if (state.blocks.some(b => b.id === action.id)) return state;
      const block: StreamBlock = { id: action.id, kind: action.kind, status: 'streaming' };
      return { ...state, phase: 'materializing', blocks: [...state.blocks, block] };
    }
    case 'block.delta':
      return {
        ...state,
        blocks: state.blocks.map(b => (b.id === action.id ? applyBlockDelta(b, action.payload) : b)),
      };
    case 'block.end':
      return {
        ...state,
        blocks: state.blocks.map(b => (b.id === action.id ? { ...b, status: 'complete' } : b)),
      };
    case 'done':
      return { ...state, phase: 'done' };
    case 'error':
      return { ...state, phase: 'error', error: action.message };
    default:
      return state;
  }
}

export interface UseStreamResult extends StreamState {
  /** Abort the in-flight stream; phase becomes 'stopped'. */
  stop: () => void;
}

/** Subscribe to a StreamSource and reduce its events into render-ready state.
 *  Re-subscribes when `source` changes; aborts on unmount or stop(). Pass null
 *  to stay idle. */
export function useStream(source: StreamSource | null): UseStreamResult {
  const [state, dispatch] = useReducer(streamReducer, initialStreamState);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!source) return;
    dispatch({ type: 'reset' });
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let cancelled = false;
    (async () => {
      try {
        for await (const ev of source(ctrl.signal)) {
          if (cancelled || ctrl.signal.aborted) break;
          dispatch(ev);
        }
      } catch (err) {
        if (!ctrl.signal.aborted) {
          dispatch({ type: 'error', message: err instanceof Error ? err.message : 'Stream failed' });
        }
      }
    })();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [source]);

  const stop = () => {
    abortRef.current?.abort();
    dispatch({ type: 'stopped' });
  };

  return { ...state, stop };
}
