/**
 * Administration — shared presentational primitives.
 *
 * The small widgets the four admin sections share: InitialsAvatar, StatLedger,
 * MemberSearch, DetailField, RowActions. Constants/tokens live in the sibling
 * `adminTokens.ts` (split so Fast Refresh stays happy).
 */

import { Search, X, ChevronDown, Check } from 'lucide-react';
import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { KpiCountUp } from '../shared/KpiTile';
import type { Stat } from './adminTokens';

/**
 * Brand-tinted initials avatar — monochrome on purpose so people lists stay
 * calm. A soft brand gradient + hairline inset ring give it depth without
 * introducing per-person colour (never a rainbow avatar).
 */
export function InitialsAvatar({ name, size = 32 }: { name: string; size?: number }) {
  // Unicode-safe: skip empty parts, take the first glyph of the first two words.
  const letters = name.trim().split(/\s+/).filter(Boolean).map(p => Array.from(p)[0] ?? '').join('');
  const initials = (Array.from(letters).slice(0, 2).join('') || '?').toUpperCase();
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 bg-brand-100 text-brand-700 font-semibold ring-1 ring-inset ring-brand-600/10 tracking-tight select-none"
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
  // 'attention' flags an actionable gap (e.g. people on no team) in amber —
  // overridden by the brand 'active' (filter-selected) state when both apply.
  const attn = stat.tone === 'attention' && !active;
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
      className={`group/kpi flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-[border-color,box-shadow,background-color] duration-300 ${
        onClick ? 'cursor-pointer hover:border-brand-200 hover:shadow-[0_12px_28px_-14px_rgba(15,8,30,0.22)]' : 'cursor-default'
      } ${active
        ? 'border-brand-200 bg-brand-50/40 shadow-[inset_0_-2px_0_0_#6A12CD]'
        : attn
          ? 'border-mitigated-700/25 bg-mitigated-50/60'
          : 'border-canvas-border bg-canvas-elevated'}`}
    >
      {Icon && (
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${active ? 'bg-brand-600 text-white shadow-sm' : attn ? 'bg-mitigated-700/12 text-mitigated-700' : `bg-brand-50 text-brand-600 ${onClick ? 'group-hover/kpi:bg-brand-100' : ''}`}`}>
          <Icon size={14} strokeWidth={2} />
        </div>
      )}
      <div className="min-w-0 flex items-baseline gap-1.5">
        <span className={`text-[1.125rem] font-bold leading-none tabular-nums ${active ? 'text-brand-800' : attn ? 'text-mitigated-700' : 'text-ink-900'}`}>
          <KpiCountUp value={String(stat.value)} delay={120 + index * 80} />
        </span>
        <span className={`text-[0.75rem] font-medium truncate ${attn ? 'text-mitigated-700/80' : 'text-ink-500'}`}>
          {stat.label}
        </span>
      </div>
    </motion.div>
  );
}

/* ── KPI card row — the 4-up metric band each admin section opens on. ── */
export function AdminKpiRow({ stats, active, onSelect }: { stats: Stat[]; active?: string; onSelect?: (key: string) => void }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
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
/**
 * AdminSelect — the platform dropdown (matches DefaultRoleSelector / the custom
 * menus elsewhere): a styled trigger + a floating panel with a brand check on
 * the active row. Replaces native `<select>` so the menu never falls back to the
 * OS-native dark rendering. Closes on outside-click, Esc, or selection.
 *
 *   size="md"  → form-field scale (h-10, 0.8125rem) for drawer/modal fields
 *   size="sm"  → compact inline scale (h-8, 0.75rem) for row pickers
 */
export interface AdminSelectOption { value: string; label: string; hint?: string }

export function AdminSelect({
  value, onChange, options, placeholder = 'Select', size = 'md',
  className = '', ariaLabel, align = 'start',
}: {
  value: string;
  onChange: (value: string) => void;
  options: AdminSelectOption[];
  placeholder?: string;
  size?: 'sm' | 'md';
  className?: string;
  ariaLabel?: string;
  align?: 'start' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();
  const labelId = useId();

  const selected = options.find(o => o.value === value) ?? null;
  const sm = size === 'sm';

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Open the menu with the highlight already on the current selection, so
  // keyboard nav starts where the user left off (no setState-in-effect).
  const openMenu = () => {
    const i = options.findIndex(o => o.value === value);
    setActiveIdx(i < 0 ? 0 : i);
    setOpen(true);
  };

  const commit = (v: string) => { onChange(v); setOpen(false); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); openMenu(); }
      return;
    }
    switch (e.key) {
      case 'Escape': e.preventDefault(); setOpen(false); break;
      case 'ArrowDown': e.preventDefault(); setActiveIdx(i => Math.min(options.length - 1, i + 1)); break;
      case 'ArrowUp': e.preventDefault(); setActiveIdx(i => Math.max(0, i - 1)); break;
      case 'Enter': case ' ': e.preventDefault(); if (options[activeIdx]) commit(options[activeIdx].value); break;
    }
  };

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`no-focus-ring w-full inline-flex items-center justify-between gap-1.5 rounded-md border bg-canvas-elevated text-ink-800 outline-none transition-colors cursor-pointer ${
          sm ? 'h-8 pl-2.5 pr-2 text-[0.75rem]' : 'h-10 pl-3 pr-2.5 text-[0.8125rem]'
        } ${open ? 'border-brand-600' : 'border-canvas-border hover:border-brand-200'}`}
      >
        <span className={`flex-1 min-w-0 text-left truncate ${selected ? '' : 'text-ink-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={sm ? 12 : 14} className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180 text-brand-600' : 'text-ink-400'}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            aria-labelledby={ariaLabel ? undefined : labelId}
            initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.13, ease: [0.2, 0, 0, 1] }}
            className={`absolute z-30 mt-1.5 min-w-full max-h-[260px] overflow-y-auto bg-canvas-elevated border border-canvas-border rounded-xl shadow-[0_10px_30px_-12px_rgba(15,8,30,0.28)] p-1 ${
              align === 'end' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'
            }`}
          >
            {options.map((o, i) => {
              const sel = o.value === value;
              const active = i === activeIdx;
              return (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={sel}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => commit(o.value)}
                  className={`flex items-center justify-between gap-2 px-2.5 h-8 rounded-md text-[0.8125rem] cursor-pointer transition-colors ${
                    sel ? 'bg-brand-50 text-brand-700 font-semibold' : active ? 'bg-canvas text-ink-700' : 'text-ink-700'
                  }`}
                >
                  <span className="flex items-baseline gap-1.5 min-w-0">
                    <span className="truncate">{o.label}</span>
                    {o.hint && <span className="text-[0.6875rem] text-ink-400 shrink-0">{o.hint}</span>}
                  </span>
                  {sel && <Check size={14} className="shrink-0 text-brand-600" />}
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

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
