/**
 * Administration — shared presentational primitives.
 *
 * The small widgets the four admin sections share: InitialsAvatar, StatLedger,
 * MemberSearch, DetailField, RowActions. Constants/tokens live in the sibling
 * `adminTokens.ts` (split so Fast Refresh stays happy).
 */

import { Search, X } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { KpiCountUp } from '../shared/KpiTile';
import type { Stat } from './adminTokens';

/**
 * Brand-tinted initials avatar — monochrome on purpose so people lists stay
 * calm. Matches the platform people convention (`bg-primary/15 text-primary`).
 */
export function InitialsAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div
      className="rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}

export function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-2">{label}</div>
      {children}
    </div>
  );
}

export function MemberSearch({ value, onChange, placeholder, className = '' }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 h-10 rounded-lg border border-canvas-border bg-canvas-elevated focus-within:border-brand-600 transition-colors ${className}`}>
      <Search size={14} className="text-ink-400 shrink-0" />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent outline-none text-[0.8125rem] text-ink-800 placeholder:text-ink-400"
      />
      {value && (
        <button onClick={() => onChange('')} className="text-ink-400 hover:text-ink-700 cursor-pointer shrink-0" aria-label="Clear search">
          <X size={13} />
        </button>
      )}
    </div>
  );
}

export function RowActions({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-1">{children}</div>;
}

/* ── KPI card — the canonical dashboard tile shape: a label + brand icon chip on
      top, then a large count-up value below, on a flat hairline card. Uses the
      platform KpiCountUp + spring cascade. When clickable it doubles as a filter:
      hover lifts it, and the active card carries the spec's 2px brand-600 bottom
      accent (inset shadow — neutral border + height never shift) with a brand
      wash + a solid brand icon chip. ── */
function AdminKpiCard({ stat, index, active, onClick }: { stat: Stat; index: number; active?: boolean; onClick?: () => void }) {
  const prefersReducedMotion = useReducedMotion();
  const Icon = stat.icon;
  return (
    <motion.div
      role={onClick ? 'button' : 'listitem'}
      aria-label={`${stat.label}: ${stat.value}`}
      aria-pressed={onClick ? !!active : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 18, mass: 0.7, delay: 0.08 + index * 0.08 }}
      whileHover={onClick && !prefersReducedMotion ? { y: -3, transition: { type: 'spring', stiffness: 420, damping: 22 } } : undefined}
      className={`group/kpi flex min-h-[112px] flex-col justify-between gap-3 rounded-xl border px-4 pt-3.5 pb-4 transition-[border-color,box-shadow,background-color] duration-300 ${
        onClick ? 'cursor-pointer hover:border-brand-200 hover:shadow-[0_12px_28px_-14px_rgba(15,8,30,0.22)]' : 'cursor-default'
      } ${active ? 'border-brand-200 bg-brand-50/40 shadow-[inset_0_-2px_0_0_#6A12CD]' : 'border-canvas-border bg-canvas-elevated'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="pt-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-500 leading-tight">
          {stat.label}
        </p>
        {Icon && (
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${active ? 'bg-brand-600 text-white shadow-sm' : `bg-brand-50 text-brand-600 ${onClick ? 'group-hover/kpi:bg-brand-100' : ''}`}`}>
            <Icon size={17} strokeWidth={2} />
          </div>
        )}
      </div>
      <p className={`text-[2rem] font-bold leading-none tabular-nums ${active ? 'text-brand-800' : 'text-ink-900'}`}>
        <KpiCountUp value={String(stat.value)} delay={120 + index * 80} />
      </p>
    </motion.div>
  );
}

/* ── KPI card row — the 4-up metric band each admin section opens on. ── */
export function AdminKpiRow({ stats, active, onSelect }: { stats: Stat[]; active?: string; onSelect?: (key: string) => void }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
      {stats.map((s, i) => (
        <AdminKpiCard
          key={s.key}
          stat={s}
          index={i}
          active={active === s.key}
          onClick={onSelect ? () => onSelect(s.key) : undefined}
        />
      ))}
    </div>
  );
}

/* ── KPI tiles — a connected, hairline-divided strip of dashboard tiles. Each
      tile is label-top (micro-uppercase) over a confident tabular numeral, with
      a quiet glyph in the corner. Cells optionally double as click-to-filter
      chips: the active tile tints brand, brightens its glyph, and carries a
      brand baseline bar. Bigger and calmer than a number-over-label row — reads
      as a real metric band, the Linear/Notion dashboard convention. ── */
export function StatLedger({ stats, active, onSelect }: { stats: Stat[]; active?: string; onSelect?: (key: string) => void }) {
  const clickable = !!onSelect;
  return (
    <div className="flex items-center flex-wrap gap-x-3.5 gap-y-1">
      {stats.map((s, i) => {
        const isActive = active === s.key;
        const content = (
          <span className="inline-flex items-baseline gap-1.5">
            <span className={`text-[0.8125rem] transition-colors ${isActive ? 'text-brand-700 font-medium' : 'text-ink-500 group-hover/stat:text-ink-700'}`}>{s.label}</span>
            <span className={`text-[0.8125rem] font-semibold tabular-nums transition-colors ${isActive ? 'text-brand-700' : 'text-ink-900'}`}>{s.value}</span>
            {s.hint && <span className="text-[0.625rem] text-ink-400 tabular-nums">{s.hint}</span>}
          </span>
        );
        return (
          <Fragment key={s.key}>
            {i > 0 && <span className="text-ink-300 select-none" aria-hidden="true">·</span>}
            {clickable
              ? <button onClick={() => onSelect!(s.key)} aria-pressed={isActive} className="group/stat inline-flex items-center cursor-pointer no-focus-ring">{content}</button>
              : <span className="inline-flex items-center">{content}</span>}
          </Fragment>
        );
      })}
    </div>
  );
}
