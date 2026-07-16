import { useState, useRef, useLayoutEffect, type ReactNode } from 'react';

/**
 * A robust replacement for recharts' own <ResponsiveContainer>.
 *
 * recharts 3.x measures its parent with a ResizeObserver that reports 0 on the
 * first paint, which recharts turns into the console warning
 *   "The width(-1) and height(-1) of chart should be greater than 0"
 * Most charts recover on the next observer tick, but a chart that mounts inside
 * an animating / scaling container (the member modal enters at scale 0.98) can
 * latch onto that first 0 and never redraw, so it renders blank at zero width.
 *
 * This wrapper measures its OWN box, holds the chart back until both dimensions
 * are positive, then renders the chart with explicit numeric width/height — the
 * recharts fixed-size API, which neither warns nor renders empty.
 *
 * Drop-in shapes:
 *   <ChartAutoSizer>{({ width, height }) => <BarChart width={width} height={height} …/>}</ChartAutoSizer>
 *     — fills its parent (parent must have a resolved height), like height="100%".
 *   <ChartAutoSizer height={140}>{…}</ChartAutoSizer>
 *     — owns its height, like height={140}.
 */
export default function ChartAutoSizer({
  height,
  children,
}: {
  /** Fixed pixel height. Omit to fill the parent's height (measured live). */
  height?: number;
  children: (size: { width: number; height: number }) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: height ?? 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () =>
      setSize({ width: el.clientWidth, height: height ?? el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [height]);

  const ready = size.width > 0 && size.height > 0;
  return (
    <div ref={ref} style={{ width: '100%', height: height ?? '100%' }}>
      {ready && children(size)}
    </div>
  );
}
