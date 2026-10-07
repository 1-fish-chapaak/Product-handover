import { test, expect } from '@playwright/test';
import {
  racmConfig,
  racmConfigSnapshot,
  resetRacmConfig,
  setRacmConfig,
} from '../src/components/sox-icfr/racmConfig';

/**
 * THE SNAPSHOT `useSyncExternalStore` READS HAS TO BE THE SAME OBJECT.
 *
 * `useRacmConfig` hands React a snapshot of one client group's column set-up.
 * React compares snapshots BY REFERENCE: give it a new object when nothing has
 * changed and it re-renders, reads again, gets another new object, and loops
 * until it gives up with "Maximum update depth exceeded".
 *
 * That is what shipped. `racmConfig(key)` returns a FRESH object for a key
 * nobody has configured — deliberately, so a caller spreading the built-in
 * shape cannot reach the copy everyone else reads — and the hook passed it
 * straight to React. Every client group starts unconfigured, so the full-page
 * RACM editor crashed on every RACM the day it was created. It reached the user
 * as a minified React #185 naming no file of ours; the line that identifies it
 * is the warning logged beside it, "The result of getSnapshot should be cached
 * to avoid an infinite loop".
 *
 * Both halves are held below. A fix that simply froze one shared default would
 * pass the stability tests and fail the last one, leaving the editor showing a
 * set-up the Config tab had already changed.
 *
 * No browser and no dev server: the module reaches `localStorage` inside a
 * try/catch, so under Node it reads as "nothing saved" — which is exactly the
 * state that used to crash.
 */

/** A key no other test has touched, so saving in one cannot be read by another. */
const freshKey = () => `group-${Math.random().toString(36).slice(2, 10)}`;

test('an unconfigured key gives the same snapshot object every time', () => {
  // The defect, stated directly. Before the fix these were two objects and the
  // editor re-rendered forever.
  const key = freshKey();
  const a = racmConfigSnapshot(key);
  const b = racmConfigSnapshot(key);
  expect(a).toBe(b);
  expect(a.configured).toBe(false);
  expect(a.core.length).toBeGreaterThan(0);
});

test('a configured key gives the same snapshot object every time', () => {
  const key = freshKey();
  setRacmConfig(key, { sampleFileName: 'vendor-racm.xlsx' });
  expect(racmConfigSnapshot(key)).toBe(racmConfigSnapshot(key));
});

test('two keys do not share a snapshot', () => {
  const a = freshKey();
  const b = freshKey();
  expect(racmConfigSnapshot(a)).not.toBe(racmConfigSnapshot(b));
});

test('racmConfig itself still hands out a fresh object each call', () => {
  // The property the cache had to work AROUND rather than remove: a caller
  // spreading the built-in shape must never reach what everyone else reads.
  const key = freshKey();
  const a = racmConfig(key);
  const b = racmConfig(key);
  expect(a).not.toBe(b);
  expect(a).toEqual(b);
  a.core.push('riskId');
  expect(racmConfig(key).core).toEqual(b.core);
});

test('saving a set-up replaces the snapshot rather than freezing it', () => {
  // The other half. A cache that never cleared would pass every test above and
  // quietly hold the editor on a set-up the Config tab had already changed —
  // the same bug wearing the opposite face.
  const key = freshKey();
  const before = racmConfigSnapshot(key);
  expect(before.configured).toBe(false);

  setRacmConfig(key, { sampleFileName: 'vendor-racm.xlsx' });

  const after = racmConfigSnapshot(key);
  expect(after).not.toBe(before);
  expect(after.configured).toBe(true);
  expect(after.sampleFileName).toBe('vendor-racm.xlsx');
});

test('resetting a set-up replaces the snapshot too', () => {
  const key = freshKey();
  setRacmConfig(key, { sampleFileName: 'vendor-racm.xlsx' });
  const configured = racmConfigSnapshot(key);

  resetRacmConfig(key);

  const after = racmConfigSnapshot(key);
  expect(after).not.toBe(configured);
  expect(after.configured).toBe(false);
});
