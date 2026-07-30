// ─── useInsightStackRun — InsightGenerator's state machine, headless ────────
//
// For surfaces that gate generation from compact chrome (the engagement
// header's launcher pill) and render the result somewhere else (the insights
// slide-over). Same session caches, same demo hooks (?insightDemo=), same
// pipeline timing as InsightGenerator — and the same cross-altitude seeding,
// so one Generate here still lights up every row-level surface below it.
//
// The cache key matches what InsightGenerator's multi mode would compute for
// the same subjects, so results generated before this hook existed (or by any
// remaining InsightGenerator host on the same subject set) are shared.

import { useEffect, useRef, useState } from 'react';
import { buildLayeredInsight, type BuildInsightInput, type InsightLayer, type LayeredInsight } from '../../data/layeredInsights';
import { CACHE, MULTI_CACHE, EMPTY_CACHE, cacheKey, notifyCacheChanged } from './insightCache';
import { demoOutcome, stackSteps, STEP_MS } from './InsightGenerator';

export type StackRunPhase = 'idle' | 'generating' | 'generated' | 'empty' | 'error';
type Outcome = 'insight' | 'empty' | 'error';

export interface InsightStackRun {
  phase: StackRunPhase;
  /** Index of the pipeline step currently running. */
  step: number;
  steps: string[];
  /** Decided up front — lets the generating view swap the last step label. */
  outcome: Outcome;
  failedStep: number;
  stack: LayeredInsight[] | null;
  run: () => void;
}

export function useInsightStackRun({ layer, subjectId, subjects, onSettled }: {
  layer: InsightLayer;
  subjectId: string;
  subjects: BuildInsightInput[];
  /** Fires when a run finishes (never on a cache restore) — open the results
   *  surface here. Errors fire too, so the caller can choose not to. */
  onSettled?: (phase: 'generated' | 'empty' | 'error') => void;
}): InsightStackRun {
  const key = `${cacheKey(layer, subjectId)}:stack:${subjects.length}`;
  const cached = MULTI_CACHE.get(key) ?? null;

  const [stack, setStack] = useState<LayeredInsight[] | null>(cached);
  const [phase, setPhase] = useState<StackRunPhase>(cached ? 'generated' : EMPTY_CACHE.has(key) ? 'empty' : 'idle');
  const [step, setStep] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>('insight');
  const [failedStep, setFailedStep] = useState(0);
  const attempts = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const steps = stackSteps(subjects.length);

  const run = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    attempts.current += 1;

    // Decide the outcome up front (the mock engine can't fail on its own).
    const demo = demoOutcome();
    let next: Outcome;
    if (demo === 'error-once') next = attempts.current === 1 ? 'error' : 'insight';
    else if (demo === 'empty' || demo === 'error') next = demo;
    else if (subjects.length === 0) next = 'empty';
    else next = 'insight';

    setOutcome(next);
    setPhase('generating');
    setStep(0);

    if (next === 'error') {
      const failAt = Math.min(2, steps.length - 1);
      setFailedStep(failAt);
      for (let i = 0; i < failAt; i++) {
        timers.current.push(setTimeout(() => setStep(i + 1), STEP_MS * (i + 1)));
      }
      timers.current.push(setTimeout(() => { setPhase('error'); settledRef.current?.('error'); }, STEP_MS * (failAt + 1) + 780));
      return;
    }

    steps.forEach((_, i) => {
      timers.current.push(setTimeout(() => setStep(i + 1), STEP_MS * (i + 1)));
    });
    timers.current.push(setTimeout(() => {
      if (next === 'empty') {
        EMPTY_CACHE.add(key);
        setStack(null);
        setPhase('empty');
        settledRef.current?.('empty');
        return;
      }
      EMPTY_CACHE.delete(key);
      const stamp = Date.now(); // drives each card header's "N min ago"
      const built = subjects.map(s => ({ ...buildLayeredInsight(s), generatedAt: stamp }));
      MULTI_CACHE.set(key, built);
      // Seed each subject's single-card cache too, so row-level surfaces
      // (control rows, workflow rows) reveal their insight without a second
      // Generate — one engagement-level run fills every altitude below it.
      built.forEach(b => CACHE.set(cacheKey(b.layer, b.subjectId), b));
      notifyCacheChanged();
      setStack(built);
      setPhase('generated');
      settledRef.current?.('generated');
    }, STEP_MS * (steps.length + 1)));
  };

  return { phase, step, steps, outcome, failedStep, stack, run };
}
