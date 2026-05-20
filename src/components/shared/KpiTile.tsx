import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

// ────────────────────── KPI count-up ──────────────────────
// Parses a formatted KPI string into prefix / number / suffix so the
// numeric portion can be animated 0 → target while currency symbols and
// abbreviations (₹, M, L, K, %) stay locked.
function parseKpiValue(v: string): { prefix: string; num: number; suffix: string; decimals: number } | null {
  const m = v.match(/^([^\d.-]*)([\d.,]+)([^\d.,]*)$/);
  if (!m) return null;
  const [, prefix, numStr, suffix] = m;
  const cleaned = numStr.replace(/,/g, '');
  const decimals = cleaned.includes('.') ? cleaned.split('.')[1].length : 0;
  const num = parseFloat(cleaned);
  if (Number.isNaN(num)) return null;
  return { prefix, num, suffix, decimals };
}

export function KpiCountUp({ value, delay = 0, duration = 1400 }: { value: string; delay?: number; duration?: number }) {
  const prefersReducedMotion = useReducedMotion();
  const parsed = useMemo(() => parseKpiValue(value), [value]);
  const [n, setN] = useState(parsed && !prefersReducedMotion ? 0 : parsed?.num ?? 0);
  const [popped, setPopped] = useState(false);

  useEffect(() => {
    if (!parsed) return;
    if (prefersReducedMotion) { setN(parsed.num); return; }
    let raf = 0;
    let to: ReturnType<typeof setTimeout>;
    const begin = () => {
      const start = performance.now();
      // ease-out-back with ~7% overshoot — "soft professional bouncy".
      const c1 = 1.18;
      const c3 = c1 + 1;
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / duration);
        const eased = 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
        setN(parsed.num * eased);
        if (p < 1) raf = requestAnimationFrame(tick);
        else setPopped(true);
      };
      raf = requestAnimationFrame(tick);
    };
    if (delay > 0) to = setTimeout(begin, delay); else begin();
    return () => { cancelAnimationFrame(raf); if (to!) clearTimeout(to); };
  }, [parsed, delay, duration, prefersReducedMotion]);

  if (!parsed) return <>{value}</>;
  return (
    <motion.span
      className="inline-block"
      animate={popped && !prefersReducedMotion ? { scale: [1, 1.04, 1] } : { scale: 1 }}
      transition={{ duration: 0.36, ease: [0.34, 1.56, 0.64, 1] }}
    >
      {parsed.prefix}{n.toFixed(parsed.decimals)}{parsed.suffix}
    </motion.span>
  );
}

// ────────────────────── KPI tile ──────────────────────
// Canonical KPI tile shared by chat audit results, chat summary KPIs,
// the workspace Output tab, and Dashboard KPI rows. Single source of truth:
// label (11px uppercase ink-500) above value (26px bold ink-900 tabular,
// count-up animated). Spring entry with index-staggered cascade. Hover
// gives a soft lift + brand-200 border + soft purple-tinted shadow.
export interface KpiTileProps {
  label: string;
  value: string;
  /** Index used for the staggered entry cascade (80ms per step). */
  index?: number;
  /** Optional click handler — when set, cursor and aria role become button. */
  onClick?: () => void;
  /** Optional inline rename / edit slot rendered in place of label+value. */
  editing?: React.ReactNode;
  /** Optional supplementary footer (e.g. dashboard "Source: field"). */
  footer?: React.ReactNode;
  className?: string;
}

export function KpiTile({ label, value, index = 0, onClick, editing, footer, className = '' }: KpiTileProps) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      role={onClick ? 'button' : 'listitem'}
      aria-label={editing ? undefined : `${label}: ${value}`}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { type: 'spring', stiffness: 320, damping: 18, mass: 0.7, delay: 0.08 + index * 0.08 }
      }
      whileHover={prefersReducedMotion ? undefined : { y: -3, scale: 1.015, transition: { type: 'spring', stiffness: 420, damping: 22 } }}
      whileTap={onClick && !prefersReducedMotion ? { scale: 0.985 } : undefined}
      className={`glass-card rounded-xl px-5 py-4 hover:border-brand-200 hover:shadow-[0_12px_28px_-14px_rgba(15,8,30,0.22)] transition-[border-color,box-shadow] duration-300 ${onClick ? 'cursor-pointer' : 'cursor-default'} ${className}`}
    >
      {editing ?? (
        <>
          <p className="text-[11px] font-semibold text-ink-500 uppercase tracking-wide mb-2 truncate" aria-hidden="true">
            {label}
          </p>
          <p className="text-[26px] font-bold text-ink-900 leading-none tabular-nums" aria-hidden="true">
            <KpiCountUp value={value} delay={120 + index * 80} />
          </p>
          {footer && <div className="mt-2">{footer}</div>}
        </>
      )}
    </motion.div>
  );
}
