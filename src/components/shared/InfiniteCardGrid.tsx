import { type ReactNode } from 'react';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';

const DEFAULT_GRID = 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-6';

/** Placeholder that mirrors ReportCard's footprint while the next batch loads. */
function SkeletonCard() {
  return (
    <div className="bg-canvas-elevated border border-canvas-border rounded-[12px] p-5 min-h-[176px] flex flex-col animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="w-9 h-9 rounded-[10px] bg-paper-50" />
        <div className="h-3 w-12 rounded bg-paper-50" />
      </div>
      <div className="h-4 w-3/4 rounded bg-paper-50 mb-2" />
      <div className="h-3 w-1/2 rounded bg-paper-50" />
      <div className="mt-auto pt-4 flex items-center gap-2">
        <div className="h-6 w-16 rounded-full bg-paper-50" />
        <div className="h-6 w-12 rounded-full bg-paper-50" />
      </div>
    </div>
  );
}

interface Props<T> {
  items: T[];
  /** Renders one card. `index` is batch-local (0…pageSize-1) so each loaded
   *  page gets its own entrance cascade instead of an ever-growing delay. The
   *  returned element must carry a stable `key`. */
  renderItem: (item: T, index: number) => ReactNode;
  /** Filter/search/tab signature — changing it restarts from the first page. */
  resetKey?: unknown;
  pageSize?: number;
  /** Override the grid track classes (defaults to the 1/2/3-column report grid). */
  className?: string;
  /** Skeleton cards shown while the next batch resolves. */
  skeletonCount?: number;
}

/**
 * Card grid that mounts its items in scroll-triggered batches via
 * {@link useInfiniteScroll}. Keeps the initial paint light and, against a real
 * API, turns one giant fetch into small per-page requests.
 */
export default function InfiniteCardGrid<T>({
  items,
  renderItem,
  resetKey,
  pageSize = 12,
  className = DEFAULT_GRID,
  skeletonCount = 3,
}: Props<T>) {
  const { visible, hasMore, loading, sentinelRef, shown, total } = useInfiniteScroll(items, {
    pageSize,
    resetKey,
  });

  return (
    <>
      <div className={className}>
        {visible.map((item, i) => renderItem(item, i % pageSize))}
        {loading &&
          Array.from({ length: skeletonCount }).map((_, i) => <SkeletonCard key={`sk-${i}`} />)}
      </div>
      {hasMore ? (
        <div
          ref={sentinelRef}
          className="h-10 -mt-2 flex items-center justify-center"
          aria-hidden="true"
        >
          {loading && (
            <span className="inline-flex items-center gap-2 text-[12px] text-ink-400">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-ink-300 border-t-transparent animate-spin" />
              Loading more…
            </span>
          )}
        </div>
      ) : (
        total > pageSize && (
          <div className="pb-2 text-center text-[11px] text-ink-400 tabular-nums">
            Showing all {shown} of {total}
          </div>
        )
      )}
    </>
  );
}
