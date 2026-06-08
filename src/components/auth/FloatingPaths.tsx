/**
 * Floating Paths — 21st.dev "Background Paths" (Aceternity). Two mirrored sets
 * of flowing SVG line paths whose stroke animates (pathLength + pathOffset)
 * in a slow loop. Recolored to white/lavender at low opacity so it reads as a
 * subtle current of light over the brand panel. Decorative, pointer-events
 * none, returns null under prefers-reduced-motion.
 */

import { motion, useReducedMotion } from 'motion/react';

function PathGroup({ position }: { position: number }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.5 + i * 0.03,
  }));

  return (
    <svg className="absolute inset-0 h-full w-full text-white" viewBox="0 0 696 316" fill="none">
      {paths.map((path) => (
        <motion.path
          key={path.id}
          d={path.d}
          stroke="currentColor"
          strokeWidth={path.width}
          strokeOpacity={0.05 + path.id * 0.012}
          initial={{ pathLength: 0.3, opacity: 0.5 }}
          animate={{ pathLength: 1, opacity: [0.2, 0.4, 0.2], pathOffset: [0, 1, 0] }}
          transition={{ duration: 20 + Math.random() * 10, repeat: Infinity, ease: 'linear' }}
        />
      ))}
    </svg>
  );
}

export default function FloatingPaths() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div className="absolute inset-0 pointer-events-none opacity-60" aria-hidden="true">
      <PathGroup position={1} />
      <PathGroup position={-1} />
    </div>
  );
}
