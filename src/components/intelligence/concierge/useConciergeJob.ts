import { useCallback, useEffect, useRef, useState } from 'react';
import type { JobState, Stage } from './types';

// ─── Mock job engine ─────────────────────────────────────────────────────────
// Replaces the production axios + React-Query polling. `start(input)` walks
// UPLOADING → PROCESSING (ticking progress across `stages`) → COMPLETED with
// buildResult(input). No network. `cancel`/`reset` return to IDLE.

interface Cfg<I, R> {
  stages: Stage[];
  buildResult: (input: I) => R;
  /** Total processing time (ms) across all stages. Default 7000. */
  totalMs?: number;
  /** Brief UPLOADING phase (ms). Default 900. */
  uploadMs?: number;
  /** Optional per-stage status lines; defaults to stage labels. */
  messages?: string[];
}

const TICK = 120;

function initial<R>(): JobState<R> {
  return {
    status: 'IDLE',
    stageIndex: 0,
    progress: 0,
    message: '',
    activity: [],
    result: null,
    error: null,
    startedAt: null,
    elapsedMs: null,
  };
}

export function useConciergeJob<I, R>(cfg: Cfg<I, R>) {
  const { stages, buildResult, totalMs = 7000, uploadMs = 900, messages } = cfg;
  const [state, setState] = useState<JobState<R>>(() => initial<R>());

  const timers = useRef<number[]>([]);
  const interval = useRef<number | null>(null);
  // Keep the latest config in refs so the ticking closure never goes stale.
  const cfgRef = useRef({ stages, buildResult, totalMs, messages });
  cfgRef.current = { stages, buildResult, totalMs, messages };

  const clearAll = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    if (interval.current != null) {
      window.clearInterval(interval.current);
      interval.current = null;
    }
  }, []);

  useEffect(() => () => clearAll(), [clearAll]);

  const reset = useCallback(() => {
    clearAll();
    setState(initial<R>());
  }, [clearAll]);

  const cancel = reset;

  /** Jump straight to a finished result (used to re-open a history row). */
  const complete = useCallback(
    (result: R) => {
      clearAll();
      setState({ ...initial<R>(), status: 'COMPLETED', progress: 100, result, elapsedMs: 0 });
    },
    [clearAll],
  );

  const start = useCallback(
    (input: I) => {
      clearAll();
      const startedAt = Date.now();
      const { stages: st } = cfgRef.current;
      setState({
        ...initial<R>(),
        status: 'UPLOADING',
        startedAt,
        message: 'Uploading…',
      });

      const up = window.setTimeout(() => {
        const begin = Date.now();
        setState((s) => ({
          ...s,
          status: 'PROCESSING',
          progress: 0,
          stageIndex: 0,
          message: cfgRef.current.messages?.[0] ?? st[0]?.label ?? 'Processing…',
          activity: st[0] ? [st[0].label] : [],
        }));

        interval.current = window.setInterval(() => {
          const { stages: stg, totalMs: tot, messages: msgs, buildResult: build } = cfgRef.current;
          const elapsed = Date.now() - begin;
          const pct = Math.min(100, Math.round((elapsed / tot) * 100));
          const si = Math.min(stg.length - 1, Math.floor((pct / 100) * stg.length));
          const msg = msgs?.[si] ?? stg[si]?.label ?? '';

          setState((s) => {
            if (s.status !== 'PROCESSING') return s;
            const activity =
              s.activity[s.activity.length - 1] === msg ? s.activity : [...s.activity, msg];
            return { ...s, progress: pct, stageIndex: si, message: msg, activity };
          });

          if (pct >= 100) {
            if (interval.current != null) {
              window.clearInterval(interval.current);
              interval.current = null;
            }
            const done = window.setTimeout(() => {
              setState((s) => ({
                ...s,
                status: 'COMPLETED',
                progress: 100,
                result: build(input),
                elapsedMs: Date.now() - startedAt,
              }));
            }, 350);
            timers.current.push(done);
          }
        }, TICK);
      }, uploadMs);

      timers.current.push(up);
    },
    [clearAll, uploadMs],
  );

  return { state, start, cancel, reset, complete };
}
