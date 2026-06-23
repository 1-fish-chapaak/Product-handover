// ATR-style document chrome shared by every generated-report surface
// (standard reports, bulk-audit reports). Mirrors AtrDocument.tsx proportions:
// brand banner, metadata grid, numbered sections, KPI tile grid.

import { motion } from 'motion/react';
import { KpiCountUp } from '../shared/KpiTile';
import { statTone } from './reportTones';
import FloatingLines from '../shared/FloatingLines';

export type ReportStat = {
  label: string;
  value: string;
  // Carried for parity with the report's stat rows; the ATR tiles render only
  // value + label, so any element type is fine.
  icon: React.ElementType;
  color: string;
};

const KPI_COL_CLASS: Record<number, string> = {
  1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3',
  4: 'md:grid-cols-4', 5: 'md:grid-cols-5', 6: 'md:grid-cols-6',
};
export function ReportKpiTiles({ stats, animate = false }: { stats: ReportStat[]; animate?: boolean }) {
  // Column count follows the number of tiles so any count (incl. 5) lays out
  // evenly — 4 stays a clean four-up; 5 becomes a five-up rather than 4 + orphan.
  const cols = KPI_COL_CLASS[Math.min(stats.length, 6)] ?? 'md:grid-cols-4';
  return (
    <div className={`grid grid-cols-2 ${cols} gap-3`}>
      {stats.map((stat, si) => {
        const tone = statTone(stat.color);
        // Canonical card chrome: flat at rest, hover tints the border (Border-First,
        // §4). The tone is carried by the corner wash + the value colour — not by a
        // 3px side-stripe, which §5 reserves for alert cards only.
        const cls = `relative overflow-hidden rounded-[14px] border border-canvas-border bg-canvas-elevated p-5 transition-colors duration-150 hover:border-brand-200`;
        const inner = (
          <>
            {/* Tone wash in the top-right corner for a subtle lift. */}
            <span
              className="absolute inset-0 pointer-events-none print:hidden"
              style={{ background: `radial-gradient(120% 120% at 100% 0%, ${tone.hex}14, transparent 58%)` }}
              aria-hidden="true"
            />
            {/* Hairline tone keyline along the top edge — ties the number's colour
                to the tile without painting the whole container. */}
            <span
              className="absolute inset-x-0 top-0 h-[2px] pointer-events-none print:hidden"
              style={{ background: `linear-gradient(to right, ${tone.hex}, ${tone.hex}00 88%)` }}
              aria-hidden="true"
            />
            <div className="relative">
              <div className={`text-[2rem] font-bold tabular-nums tracking-[-0.02em] leading-none mb-2 ${tone.text}`}>
                {animate ? <KpiCountUp value={stat.value} delay={120 + si * 80} /> : stat.value}
              </div>
              <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.09em] text-ink-500 leading-tight">{stat.label}</div>
            </div>
          </>
        );
        return animate ? (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18, mass: 0.7, delay: 0.08 + si * 0.08 }}
            className={cls}
          >
            {inner}
          </motion.div>
        ) : (
          <div key={stat.label} className={cls}>{inner}</div>
        );
      })}
    </div>
  );
}

export function ReportNumberedHeading({ n, title, subtitle, right }: {
  n: number; title: string; subtitle?: string; right?: React.ReactNode;
}) {
  // Editorial section header: a zero-padded brand index reads as an
  // annual-report chapter mark and the title carries the weight. A short brand
  // tick accents the header — the old full-width hairline rule was dropped to cut
  // the divider-line clutter; whitespace now separates sections instead.
  return (
    <div className="mb-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-baseline gap-3.5 min-w-0">
          <span className="shrink-0 text-[0.8125rem] font-semibold tabular-nums tracking-[0.16em] text-brand-700 leading-none">
            {String(n).padStart(2, '0')}
          </span>
          <div className="min-w-0">
            <h2 className="text-[1.25rem] font-semibold text-ink-900 tracking-[-0.012em] leading-[1.15]">{title}</h2>
            {subtitle && <p className="text-[0.8125rem] text-ink-500 mt-1 leading-snug">{subtitle}</p>}
          </div>
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      <span className="mt-3.5 block h-[2px] w-8 rounded-full bg-brand-500/80" aria-hidden="true" />
    </div>
  );
}

export function ReportMetaCell({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-500 mb-1.5">{label}</div>
      <div className="border-l-[3px] border-brand-500 pl-3">
        <div className="text-[0.8125rem] font-bold text-ink-900 truncate">{value}</div>
      </div>
    </div>
  );
}

// Metadata as a clean key-facts band. The facts read as a single report-info
// unit via a top brand accent + whitespace — the old internal cell dividers
// (border-r/border-b on every cell) were dropped to cut divider-line clutter.
// Empty-value facts are dropped, and the column count auto-fits the remaining
// facts (single row up to 4) unless an explicit `columns` is given.
const META_COL_CLASS: Record<number, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' };
export function ReportMetaPanel({ items, columns }: { items: { label: string; value?: string }[]; columns?: 1 | 2 | 3 | 4 }) {
  const facts = items.filter(it => it.value);
  if (facts.length === 0) return null;
  const cols = columns ?? (facts.length <= 4 ? facts.length : 3);
  return (
    <div className={`grid ${META_COL_CLASS[cols]} gap-x-8 gap-y-6 rounded-[12px] border-t-[2px] border-t-brand-500/80 bg-canvas-elevated/60 px-6 pt-5 pb-6`}>
      {facts.map((it) => (
        <div key={it.label} className="min-w-0">
          <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.15em] text-ink-400 mb-2">{it.label}</div>
          <div className="text-[0.875rem] font-medium text-ink-700 leading-snug tabular-nums break-words">{it.value || '—'}</div>
        </div>
      ))}
    </div>
  );
}

// Purple gradient report cover — floating-line art, white title, optional
// glanceable key-facts capsule top-right. Shared by the standard reader and the
// bulk-audit view. Honours a report's theme gradient; defaults to brand purple.
export function CoverBanner({ title, gradient, description, byline, actions, facts, className = '' }: {
  title: string;
  gradient?: [string, string];
  description?: React.ReactNode;
  byline?: React.ReactNode;
  actions?: React.ReactNode;
  facts?: { value: React.ReactNode; label: string }[];
  className?: string;
}) {
  const [from, to] = gradient ?? ['#3b0b72', '#6a12cd'];
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ backgroundImage: `linear-gradient(to bottom right, ${from}, ${to})` }}>
      <div
        className="absolute inset-0 z-0 print:hidden"
        style={{ maskImage: 'linear-gradient(to right, transparent 35%, white 70%)', WebkitMaskImage: 'linear-gradient(to right, transparent 35%, white 70%)' }}
        aria-hidden="true"
      >
        <FloatingLines
          enabledWaves={['top', 'middle']}
          lineCount={6}
          lineDistance={6}
          bendRadius={4}
          bendStrength={-0.3}
          interactive
          parallax={false}
          color="#e879f9"
          opacity={0.3}
        />
      </div>
      <div className="relative z-10 px-8 py-7">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <h1 className="text-[1.75rem] font-bold text-white tracking-tight leading-tight mb-1">{title}</h1>
            {description}
          </div>
          {facts && facts.length > 0 && (
            <div className="shrink-0 flex items-stretch rounded-[12px] border border-white/20 bg-white/10 overflow-hidden">
              {facts.map((f, i) => (
                <div key={f.label} className={`px-5 py-3 text-center ${i > 0 ? 'border-l border-white/15' : ''}`}>
                  <div className="text-[1.5rem] font-bold text-white tabular-nums leading-none">{f.value}</div>
                  <div className="text-[0.625rem] font-semibold uppercase tracking-wider text-white/65 mt-1.5 whitespace-nowrap">{f.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-[0.8125rem] flex-wrap">{byline}</div>
          {actions && <div className="flex items-center gap-2 print:hidden">{actions}</div>}
        </div>
      </div>
    </div>
  );
}

export function ReportBrandBanner({ title, back, actions, children, className = '', gradient, headerText, facts, footer, aside, eyebrow, titleClassName }: {
  title: string;
  /** Tailwind size class for the title (defaults to the 33px letterhead size). */
  titleClassName?: string;
  /** Optional "Back to Reports" affordance rendered above the title (top-left). */
  back?: React.ReactNode;
  /** CTAs rendered top-right on the banner, like the ATR document. */
  actions?: React.ReactNode;
  /** Description / byline content rendered under the title. */
  children?: React.ReactNode;
  className?: string;
  /** [from, to] gradient override (from the template's chosen theme). */
  gradient?: [string, string];
  /** Confidentiality / header line stamped top-right (from the template). */
  headerText?: string;
  /** Glanceable key-facts capsule, rendered top-right in the letterhead tone. */
  facts?: { value: React.ReactNode; label: string }[];
  /** Full-width metadata strip rendered below the title/actions row, edge to
      edge, with its own top hairline. Used for the report key-facts letterhead. */
  footer?: React.ReactNode;
  /** Right-column content on the title row (e.g. a metadata panel). Lets the
      banner read as two balanced columns instead of a tall left-aligned stack. */
  aside?: React.ReactNode;
  /** Small overline rendered directly above the title (e.g. a report ID). */
  eyebrow?: React.ReactNode;
}) {
  // Purple gradient letterhead — title + byline over floating-line art, with
  // actions stacked top-right. A template's theme gradient overrides the default.
  const [from, to] = gradient ?? ['#3b0b72', '#6a12cd'];
  return (
    <div
      className={`relative overflow-hidden px-9 pt-9 pb-8 ${className}`}
      style={{ backgroundImage: `linear-gradient(125deg, ${from} 0%, ${to} 62%, ${to} 100%)`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22)' }}
    >
      {/* Deepen the lower-left and lift the upper-right so the panel reads with
          depth instead of a flat sheet. */}
      <div
        className="absolute inset-0 z-0 print:hidden"
        style={{ backgroundImage: 'radial-gradient(135% 160% at 100% -10%, rgba(255,255,255,0.20), rgba(255,255,255,0) 52%), radial-gradient(120% 130% at 0% 120%, rgba(8,2,24,0.32), rgba(8,2,24,0) 55%)' }}
        aria-hidden="true"
      />
      {/* Woven line art — two layers for a denser, refined weave. No mouse
          interaction; masked to the right so the title stays crisp. */}
      <div
        className="absolute inset-0 z-0 print:hidden"
        style={{ maskImage: 'linear-gradient(to right, transparent 18%, white 56%)', WebkitMaskImage: 'linear-gradient(to right, transparent 18%, white 56%)' }}
        aria-hidden="true"
      >
        <FloatingLines enabledWaves={['top', 'middle', 'bottom']} lineCount={[3, 4, 3]} lineDistance={8} interactive={false} parallax={false} color="#c084fc" opacity={0.14} />
        <FloatingLines enabledWaves={['top', 'middle']} lineCount={3} lineDistance={10} interactive={false} parallax={false} color="#f5d0fe" opacity={0.24} />
      </div>
      {/* Readability scrim — darkens the left, where the title and byline sit,
          so text keeps full contrast while the weave stays dense on the right. */}
      <div
        className="absolute inset-0 z-0"
        style={{ backgroundImage: 'linear-gradient(to right, rgba(17,5,42,0.48), rgba(17,5,42,0.14) 40%, rgba(17,5,42,0) 62%)' }}
        aria-hidden="true"
      />
      {back && <div className="relative z-10 mb-3 print:hidden">{back}</div>}
      {/* Title anchors the top-left as the hero; actions balance top-right,
          pinned (items-start) to the title's first line. Keeping them on one row
          preserves the reading hierarchy — title first, actions second. */}
      <div className="relative z-10 flex items-start justify-between gap-5 lg:gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          {eyebrow && <div className="mb-2">{eyebrow}</div>}
          <h1 title={typeof title === 'string' ? title : undefined} className={`${titleClassName ?? 'text-[2rem]'} truncate font-bold tracking-[-0.02em] leading-[1.08] text-white mb-1.5`} style={{ textShadow: '0 1px 2px rgba(10,2,30,0.22)' }}>{title}</h1>
          {children}
        </div>
        {aside && <div className="shrink-0 w-full sm:w-auto">{aside}</div>}
        <div className="shrink-0 flex flex-col items-end gap-3 empty:hidden">
          {headerText && (
            <span className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-white/60">{headerText}</span>
          )}
          {facts && facts.length > 0 && (
            <div className="flex items-stretch rounded-[12px] border border-white/20 bg-white/10 overflow-hidden">
              {facts.map((f, i) => (
                <div key={f.label} className={`px-5 py-3 text-center ${i > 0 ? 'border-l border-white/15' : ''}`}>
                  <div className="text-[1.5rem] font-bold tabular-nums leading-none text-white">{f.value}</div>
                  <div className="text-[0.625rem] font-semibold uppercase tracking-wider text-white/65 mt-1.5 whitespace-nowrap">{f.label}</div>
                </div>
              ))}
            </div>
          )}
          {actions && <div className="flex items-center gap-2 print:hidden">{actions}</div>}
        </div>
      </div>
      {footer && (
        <div className="relative z-10 mt-5">{footer}</div>
      )}
    </div>
  );
}
