import { useState } from 'react';

export type SeriesShown = 'a' | 'b' | 'both';

/** Per-widget A / B / Both state — deliberately not persisted. */
export function useSeriesShown(): [SeriesShown, (s: SeriesShown) => void] {
  const [shown, setShown] = useState<SeriesShown>('both');
  return [shown, setShown];
}
