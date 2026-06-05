/**
 * Ambient background FX for the dark brand panel — a slow drifting particle
 * field (canvas) plus draw-in hairline accents. Sits behind content,
 * pointer-events: none, aria-hidden. Honors prefers-reduced-motion.
 *
 * Adapted from a 21st.dev community background (particle canvas + animated
 * accent lines), recolored to brand/lavender and scoped to its parent box
 * instead of the viewport.
 */

import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';

export default function BrandPanelFX() {
  const reduce = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (reduce) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const parent = canvas?.parentElement;
    if (!canvas || !ctx || !parent) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let ps: { x: number; y: number; v: number; o: number }[] = [];

    const make = () => ({
      x: Math.random() * parent.clientWidth,
      y: Math.random() * parent.clientHeight,
      v: Math.random() * 0.22 + 0.04,
      o: Math.random() * 0.4 + 0.1,
    });

    const setSize = () => {
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const init = () => {
      const count = Math.floor((parent.clientWidth * parent.clientHeight) / 11000);
      ps = Array.from({ length: count }, make);
    };

    const draw = () => {
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      ctx.clearRect(0, 0, w, h);
      for (const p of ps) {
        p.y -= p.v;
        if (p.y < 0) {
          p.x = Math.random() * w;
          p.y = h + Math.random() * 40;
        }
        ctx.fillStyle = `rgba(214,198,255,${p.o})`;
        ctx.fillRect(p.x, p.y, 0.8, 2.4);
      }
      raf = requestAnimationFrame(draw);
    };

    setSize();
    init();
    raf = requestAnimationFrame(draw);

    const ro = new ResizeObserver(() => { setSize(); init(); });
    ro.observe(parent);

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [reduce]);

  /** Hairline accent that draws in (scale) on first paint. */
  const line = (delay: number, vertical: boolean) =>
    reduce
      ? { initial: false as const }
      : {
          initial: { scaleX: vertical ? 1 : 0, scaleY: vertical ? 0 : 1, opacity: 0 },
          animate: { scaleX: 1, scaleY: 1, opacity: 1 },
          transition: { delay, duration: 0.8, ease: [0.22, 0.61, 0.36, 1] as const },
        };

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* drifting particle field */}
      <canvas ref={canvasRef} className="absolute inset-0 mix-blend-screen opacity-60" />

      {/* draw-in hairline accents */}
      <motion.div className="absolute inset-x-0 top-[20%] h-px bg-white/10 origin-center" {...line(0.3, false)} />
      <motion.div className="absolute inset-x-0 top-[78%] h-px bg-white/10 origin-center" {...line(0.45, false)} />
      <motion.div className="absolute inset-y-0 left-[24%] w-px bg-white/[0.09] origin-top" {...line(0.55, true)} />
      <motion.div className="absolute inset-y-0 left-[72%] w-px bg-white/[0.07] origin-top" {...line(0.66, true)} />
    </div>
  );
}
