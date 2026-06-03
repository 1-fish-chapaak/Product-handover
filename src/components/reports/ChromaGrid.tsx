// Light-theme wrapper adapted from the React Bits ChromaGrid component.
// The original renders dark image-based profile cards; our report cards are
// light and have no images, so this wrapper keeps the existing cards as children
// and only provides the gsap-powered cursor-following spotlight (radius / damping
// / fadeOut / ease). Add `chroma-card-lite` + onMouseMove={handleChromaCardMove}
// to each child card to get the per-card glow and colored hover border.
import { useRef, useEffect, type ReactNode, type PointerEvent, type MouseEvent, type CSSProperties } from 'react';
import { gsap } from 'gsap';
import './ChromaGrid.css';

type ChromaGridProps = {
  children: ReactNode;
  className?: string;
  radius?: number;
  damping?: number;
  fadeOut?: number;
  ease?: string;
};

export const handleChromaCardMove = (e: MouseEvent<HTMLElement>) => {
  const card = e.currentTarget;
  const rect = card.getBoundingClientRect();
  card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
  card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
};

export const ChromaGrid = ({
  children,
  className = '',
  radius = 300,
  damping = 0.45,
  fadeOut = 0.6,
  ease = 'power3.out',
}: ChromaGridProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const setX = useRef<((v: number) => void) | null>(null);
  const setY = useRef<((v: number) => void) | null>(null);
  const pos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    setX.current = gsap.quickSetter(el, '--x', 'px') as (v: number) => void;
    setY.current = gsap.quickSetter(el, '--y', 'px') as (v: number) => void;
    const { width, height } = el.getBoundingClientRect();
    pos.current = { x: width / 2, y: height / 2 };
    setX.current(pos.current.x);
    setY.current(pos.current.y);
  }, []);

  const moveTo = (x: number, y: number) => {
    gsap.to(pos.current, {
      x,
      y,
      duration: damping,
      ease,
      onUpdate: () => {
        setX.current?.(pos.current.x);
        setY.current?.(pos.current.y);
      },
      overwrite: true,
    });
  };

  const handleMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    moveTo(e.clientX - r.left, e.clientY - r.top);
    gsap.to(fadeRef.current, { opacity: 0, duration: 0.25, overwrite: true });
  };

  const handleLeave = () => {
    gsap.to(fadeRef.current, { opacity: 1, duration: fadeOut, overwrite: true });
  };

  return (
    <div
      ref={rootRef}
      className={`chroma-grid-lite ${className}`}
      style={{ '--r': `${radius}px` } as CSSProperties}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      {children}
      <div className="chroma-overlay-lite" />
      <div ref={fadeRef} className="chroma-fade-lite" />
    </div>
  );
};

export default ChromaGrid;
