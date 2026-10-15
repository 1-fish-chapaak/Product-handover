import { useSyncExternalStore } from 'react';

/**
 * Where a zero-state control is on its first walk through the test of design
 * (user ask, 8 Oct). The journey, in order:
 *
 *   Continue → Ira makes a plan → the tester approves it (or rejects it and
 *   says what to change, and Ira plans again) → Ira adds the design elements
 *   → asks for their documents → once the required ones are in, asks "shall I
 *   start testing the design checks?" → the checks load and are tested → Ira
 *   marks each pass or fail, and the tester can override.
 *
 * Only the conversation's position lives here. What is on file, which checks
 * exist and what they read is the control's own state, as everywhere else in
 * the rail (see controlChat.ts). Session-lifetime: a reload starts the demo
 * control fresh, and so does this.
 */
export type JourneyPhase =
  | 'planning'      // "Making a plan…"
  | 'proposal'      // the plan, waiting on Approve / Reject
  | 'revising'      // rejected — Ira asked what to change, the next line typed is the answer
  | 'replanning'    // "Making a new plan…"
  | 'approved'      // the elements are on the design step; documents next
  | 'held'          // evidence in, the tester said "not yet" to testing
  | 'loading-checks' // the design checks are being laid out
  | 'testing';      // checks out — the page's own run takes it from here

export interface TodJourney {
  phase: JourneyPhase;
  /** What the tester asked to change on a rejected plan, in their words. */
  note?: string;
  /** The tester took the optional flowchart off the plan. */
  skipFlowchart?: boolean;
  /** How many times the plan has been drawn — the second one says it is new. */
  version: number;
}

let JOURNEYS: Record<string, TodJourney> = {};
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const all = () => JOURNEYS;

export function useTodJourney(controlId: string): TodJourney | undefined {
  return useSyncExternalStore(subscribe, all, all)[controlId];
}

export const todJourney = (controlId: string): TodJourney | undefined => JOURNEYS[controlId];

export function setTodJourney(controlId: string, patch: Partial<TodJourney>): void {
  const prev = JOURNEYS[controlId] ?? { phase: 'planning', version: 0 };
  JOURNEYS = { ...JOURNEYS, [controlId]: { ...prev, ...patch } };
  listeners.forEach(l => l());
}
