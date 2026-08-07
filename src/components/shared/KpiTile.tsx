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

  useEffect(() => {
    if (!parsed) return;
    if (prefersReducedMotion) { setN(parsed.num); return; }
    let raf = 0;
    let to: ReturnType<typeof setTimeout>;
    const begin = () => {
      const start = performance.now();
      // Exponential ease-out. A counter must never overshoot: the number would
      // read past its true value before settling back. (DESIGN.md §6)
      // Normalised by (1 - 2^-10) so it lands on the target instead of snapping
      // the last ~0.1% on the final frame.
      const NORM = 1 - Math.pow(2, -10);
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / duration);
        const eased = (1 - Math.pow(2, -10 * p)) / NORM;
        setN(parsed.num * eased);
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    if (delay > 0) to = setTimeout(begin, delay); else begin();
    // Printing captures whatever frame the counter happens to be on, so a
    // print started mid-ramp would put a number on paper that was never the
    // real one. Snap to the target before the browser paints the print view.
    const snap = () => { cancelAnimationFrame(raf); if (to) clearTimeout(to); setN(parsed.num); };
    window.addEventListener('beforeprint', snap);
    return () => {
      cancelAnimationFrame(raf);
      if (to!) clearTimeout(to);
      window.removeEventListener('beforeprint', snap);
    };
  }, [parsed, delay, duration, prefersReducedMotion]);

  if (!parsed) return <>{value}</>;
  return (
    <span className="inline-block">
      {parsed.prefix}{n.toLocaleString('en-IN', { minimumFractionDigits: parsed.decimals, maximumFractionDigits: parsed.decimals })}{parsed.suffix}
    </span>
  );
}

// ────────────────────── KPI tile ──────────────────────
// Canonical KPI tile shared by chat audit results, chat summary KPIs,
// the workspace Output tab, and Dashboard KPI rows. Single source of truth:
// label (11px uppercase ink-500) above value (26px bold ink-900 tabular,
// count-up animated). Spring entry with index-staggered cascade. When
// clickable (onClick set), hover gives a soft lift + brand-200 border +
// soft purple-tinted shadow; non-interactive tiles stay static.
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
  /** Override the value colour (defaults to ink-900). e.g. "text-compliant-700". */
  valueClassName?: string;
  /** When true, renders an active/selected brand outline (used for KPI-as-filter tiles). */
  selected?: boolean;
  /** Skip the count-up and print the settled value straight away. For tiles
   *  inside a document or beside another surface showing the same metric,
   *  where a ramping counter means two places disagree for a second. */
  instant?: boolean;
  className?: string;
}

export function KpiTile({ label, value, index = 0, onClick, editing, footer, valueClassName = 'text-ink-900', className = '', selected = false, instant = false }: KpiTileProps) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      role={onClick ? 'button' : 'listitem'}
      aria-label={editing ? undefined : `${label}: ${value}`}
      aria-pressed={onClick ? selected : undefined}
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
      whileHover={onClick && !prefersReducedMotion ? { y: -3, scale: 1.015, transition: { type: 'spring', stiffness: 420, damping: 22 } } : undefined}
      whileTap={onClick && !prefersReducedMotion ? { scale: 0.985 } : undefined}
      className={`glass-card px-5 py-4 transition-[border-color,box-shadow] duration-300 ${selected ? '[outline:2px_solid_var(--color-brand-500)] [outline-offset:-1px]' : ''} ${onClick ? 'cursor-pointer hover:border-brand-200 hover:shadow-[0_12px_28px_-14px_rgba(15,8,30,0.22)]' : 'cursor-default'} ${className}`}
    >
      {editing ?? (
        <>
          <p className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-wide mb-2 truncate" aria-hidden="true">
            {label}
          </p>
          <p className={`text-[1.625rem] font-bold leading-none tabular-nums ${valueClassName}`} aria-hidden="true">
            {instant ? value : <KpiCountUp value={value} delay={120 + index * 80} />}
          </p>
          {footer && <div className="mt-2">{footer}</div>}
        </>
      )}
    </motion.div>
  );
}
