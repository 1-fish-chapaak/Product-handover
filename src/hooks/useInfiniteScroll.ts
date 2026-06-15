import { useState, useEffect, useRef, useCallback } from 'react';

interface Options {
  /** Items revealed per batch (and the initial count). */
  pageSize?: number;
  /** Changing this resets back to the first page — pass the filter/search/tab
   *  context so a new query starts from the top instead of keeping the old
   *  scrolled-in count. */
  resetKey?: unknown;
  /** Simulated fetch latency so the loading state is visible and the next
   *  batch isn't revealed in the same frame the sentinel appears. */
  loadDelayMs?: number;
  /** How early (before the sentinel is on screen) to request the next batch. */
  rootMargin?: string;
}

/**
 * Reveal a long list in batches as the user scrolls, instead of rendering it
 * all at once. An IntersectionObserver on a sentinel near the bottom requests
 * the next page, so only what's been scrolled to is mounted — fewer nodes per
 * paint and, when wired to a real backend, fewer rows fetched per request.
 */
export function useInfiniteScroll<T>(
  items: T[],
  { pageSize = 12, resetKey, loadDelayMs = 400, rootMargin = '240px' }: Options = {},
) {
  const [count, setCount] = useState(pageSize);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);
  const timer = useRef<number | null>(null);

  const clearTimer = () => {
    if (timer.current != null) { clearTimeout(timer.current); timer.current = null; }
  };

  // A fresh filter/search/tab context starts over at page one.
  useEffect(() => {
    clearTimer();
    loadingRef.current = false;
    setLoading(false);
    setCount(pageSize);
  }, [resetKey, pageSize]);

  const total = items.length;
  const hasMore = count < total;

  const loadMore = useCallback(() => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    timer.current = window.setTimeout(() => {
      setCount(c => Math.min(c + pageSize, total));
      loadingRef.current = false;
      setLoading(false);
      timer.current = null;
    }, loadDelayMs);
  }, [pageSize, total, loadDelayMs]);

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      entries => { if (entries[0]?.isIntersecting) loadMore(); },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
    // `count` re-arms the observer after each batch so it can fire for the next.
  }, [hasMore, loadMore, rootMargin, count]);

  useEffect(() => clearTimer, []);

  return {
    visible: items.slice(0, count),
    hasMore,
    loading,
    sentinelRef,
    shown: Math.min(count, total),
    total,
  };
}
