import type { Variants, Transition, Easing } from 'motion/react';

/**
 * Chat-streaming motion vocabulary.
 *
 * Single source of truth for the easing curves, springs, durations and stagger
 * steps used across the chat streaming surfaces. Every value here is lifted
 * verbatim from motion already living in the codebase — nothing is invented.
 *
 * Helpers all accept a `reduced` flag (the caller passes `useReducedMotion()`).
 * When reduced, they collapse to zero-offset / instant variants so users who
 * prefer reduced motion get the same end state with no movement.
 */

/** Cubic-bezier easing curves (extracted from existing components). */
export const EASE = {
  entrance: [0.22, 1, 0.36, 1],
  menu: [0.16, 1, 0.3, 1],
  pop: [0.34, 1.56, 0.64, 1],
} as const;

/** Spring transitions (extracted from existing components). */
export const SPRING = {
  kpi: { type: 'spring', stiffness: 320, damping: 18, mass: 0.7 },
  chart: { type: 'spring', stiffness: 240, damping: 26 },
  hover: { type: 'spring', stiffness: 700, damping: 32, mass: 0.12 },
} as const;

/** Durations in seconds. */
export const DURATION = {
  fast: 0.18,
  base: 0.25,
  reveal: 0.48,
} as const;

/** Stagger steps in seconds per index. */
export const STAGGER = {
  row: 0.04,
  kpi: 0.08,
  card: 0.1,
} as const;

/**
 * Fade + slide-up reveal.
 *
 * Non-reduced: fades in while rising from `y` (default 6) to 0 over
 * `DURATION.reveal` with the `entrance` easing.
 * Reduced: starts already-visible at rest with an instant (0s) transition.
 */
export function revealVariants(opts?: { y?: number; reduced?: boolean }): Variants {
  const y = opts?.y ?? 6;
  const reduced = opts?.reduced ?? false;

  if (reduced) {
    return {
      initial: { opacity: 1, y: 0 },
      animate: { opacity: 1, y: 0, transition: { duration: 0 } },
    };
  }

  return {
    initial: { opacity: 0, y },
    animate: {
      opacity: 1,
      y: 0,
      transition: { duration: DURATION.reveal, ease: EASE.entrance as Easing },
    },
  };
}

/**
 * Stagger delay for an item at `index`.
 * Returns `base + index * step` (defaults: step = STAGGER.kpi, base = 0).
 */
export function staggerDelay(
  index: number,
  step: number = STAGGER.kpi,
  base = 0,
): number {
  return base + index * step;
}

/**
 * Simple opacity fade.
 * Non-reduced: fades 0 -> 1 over `duration` (default DURATION.base).
 * Reduced: starts visible with an instant (0s) transition.
 */
export function fade(opts?: { duration?: number; reduced?: boolean }): {
  initial: object;
  animate: object;
  transition: object;
} {
  const reduced = opts?.reduced ?? false;
  const duration = reduced ? 0 : opts?.duration ?? DURATION.base;

  const transition: Transition = { duration };

  return {
    initial: { opacity: reduced ? 1 : 0 },
    animate: { opacity: 1 },
    transition,
  };
}
