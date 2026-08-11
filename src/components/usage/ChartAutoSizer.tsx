/**
 * A chart wrapper that measures its own box.
 *
 * recharts 3.8's ResponsiveContainer renders at width -1 inside a panel that is
 * laid out after mount, which draws a blank chart with no error. This measures
 * the element itself and hands the children real pixels, so a chart inside a
 * drawer, a modal or a freshly opened section draws the first time.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';

export default function ChartAutoSizer({
  height,
  children,
  className = '',
}: {
  height: number;
  children: (size: { width: number; height: number }) => ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} style={{ height }}>
      {width > 0 && children({ width, height })}
    </div>
  );
}
