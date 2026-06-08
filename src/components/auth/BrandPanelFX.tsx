/**
 * Ambient background FX for the dark brand panel — a slow drifting particle
 * field (canvas) layered with a 21st.dev / Aceternity Spotlight beam. Sits
 * behind content, pointer-events: none, aria-hidden. Honors
 * prefers-reduced-motion (particles stop).
 */

import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import Spotlight from './Spotlight';
import FloatingPaths from './FloatingPaths';

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

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* flowing background paths (21st.dev / Aceternity) */}
      <FloatingPaths />

      {/* spotlight beam (21st.dev / Aceternity) */}
      <Spotlight className="-top-40 -left-24" fill="#C393FA" />

      {/* drifting particle field */}
      <canvas ref={canvasRef} className="absolute inset-0 mix-blend-screen opacity-60" />
    </div>
  );
}
