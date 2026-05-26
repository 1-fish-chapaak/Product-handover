interface SkeletonProps {
  /** Tailwind width utility — defaults to w-full. */
  width?: string;
  /** Tailwind height utility — defaults to h-4. */
  height?: string;
  /** Tailwind rounded utility — defaults to rounded-md. */
  rounded?: string;
  className?: string;
}

/** Single shimmer rectangle. Compose larger skeletons by stacking these. */
export function Skeleton({
  width = 'w-full',
  height = 'h-4',
  rounded = 'rounded-md',
  className = '',
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`${width} ${height} ${rounded} bg-paper-100 animate-pulse ${className}`}
    />
  );
}

/** A row of skeleton cells — quick stand-in for a list item or table row. */
export function SkeletonRow({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Skeleton width="w-8" height="h-8" rounded="rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton width="w-1/2" height="h-3.5" />
        <Skeleton width="w-1/3" height="h-3" />
      </div>
    </div>
  );
}

/** A skeleton card body — title + 2 lines + meta. Useful for report cards. */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`border border-canvas-border rounded-[10px] p-5 space-y-3 ${className}`}
    >
      <Skeleton width="w-1/3" height="h-3" />
      <Skeleton width="w-3/4" height="h-4" />
      <Skeleton width="w-2/3" height="h-3" />
      <div className="flex items-center justify-between pt-2">
        <Skeleton width="w-20" height="h-3" />
        <Skeleton width="w-16" height="h-3" />
      </div>
    </div>
  );
}
