/**
 * A chart wrapper that measures its own box.
 *
 * recharts 3.8's ResponsiveContainer reports a width of -1 inside a panel that
 * is laid out after mount, and draws a blank chart with no error at all. This
 * measures the element itself and hands the children real pixels, so a chart in
 * a folded section, a drawer or a modal draws the first time it is opened.
 *
 * Nothing in this folder may use ResponsiveContainer.
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
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} style={{ height }}>
      {width > 0 && children({ width, height })}
    </div>
  );
}
