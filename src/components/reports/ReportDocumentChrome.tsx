// ATR-style document chrome shared by every generated-report surface
// (standard reports, bulk-audit reports). Mirrors AtrDocument.tsx proportions:
// brand banner, metadata grid, numbered sections, KPI tile grid.

import { motion } from 'motion/react';
import { PenLine, Check, RotateCcw } from 'lucide-react';
import FloatingLines from '../shared/FloatingLines';
import type { SignatorySlot, Signoff } from './reportShared';

export type ReportStat = {
  label: string;
  value: string;
  // Carried for parity with the report's stat rows; the ATR tiles render only
  // value + label, so any element type is fine.
  icon: React.ElementType;
  color: string;
};

// All KPIs sit on a single row — one column per metric.
const KPI_COL_CLASS: Record<number, string> = {
  1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3',
  4: 'md:grid-cols-4', 5: 'md:grid-cols-5', 6: 'md:grid-cols-6',
};
export function ReportKpiTiles({ stats, showTick = true }: { stats: ReportStat[]; animate?: boolean; showTick?: boolean }) {
  // Unified stat-bar (Stripe / Mercury pattern): one surface, the metrics split
  // by hairline dividers — not a grid of separate boxes. Interior dividers only:
  // each cell draws its top+left hairline, the grid is nudged -1px up/left and
  // the rounded surface clips the outermost lines, so any column count (incl. 5
  // or 6) and wrapping rows divide cleanly. Column count follows the tile count.
  // Static — no entry animation or count-up; the value reads instantly.
  const cols = KPI_COL_CLASS[Math.min(stats.length, 6)] ?? 'md:grid-cols-4';
  return (
    // Matches the platform's KPI vocabulary (DESIGN.md §7.2.2 / 7.10.2): flat
    // glass-card tiles, hairline borders, no shadow, no gradient. The semantic
    // red→amber→green ramp is forbidden (No-RAG rule), so colour is a single
    // uniform brand-purple icon chip (the SourceCard pattern) — never a heat
    // strip. Label (11px uppercase ink-500) over a bold tabular ink-900 value.
    <div className={`grid grid-cols-2 gap-3 ${cols}`}>
      {stats.map((stat) => {
        // The number and its underline tick take the metric's semantic tone
        // (text-<tone>-700 from stat.color); the label stays muted ink.
        const toneText = stat.color.match(/text-[\w-]+/)?.[0] ?? 'text-ink-900';
        return (
          <div key={stat.label} className="glass-card px-5 py-5">
            <p className={`text-[2.5rem] font-bold leading-none tabular-nums tracking-[-0.035em] ${toneText}`}>
              {stat.value}
            </p>
            {showTick && <span className={`mt-3.5 mb-3 block h-[2px] w-8 rounded-full bg-current ${toneText}`} aria-hidden="true" />}
            {/* Labels wrap rather than clip. A six-tile row leaves each cell
                narrow, and an explicit label ("Observations Closed") has to be
                readable in full or it stops disambiguating anything. */}
            <p className={`text-[0.625rem] font-semibold uppercase tracking-[0.05em] text-ink-400 leading-snug min-h-[1.8em] ${showTick ? '' : 'mt-4'}`}>
              {stat.label}
            </p>
          </div>
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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mb-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-baseline gap-3.5 min-w-0">
          <span
            className="shrink-0 text-[0.8125rem] font-semibold tabular-nums tracking-[0.16em] leading-none"
            style={{ color: 'var(--rep-accent, #550fa5)' }}
          >
            {String(n).padStart(2, '0')}
          </span>
          <div className="min-w-0">
            <h2 className="text-[1.25rem] font-semibold text-ink-900 tracking-[-0.012em] leading-[1.15]">{title}</h2>
            {subtitle && <p className="text-[0.8125rem] text-ink-500 mt-1 leading-snug">{subtitle}</p>}
          </div>
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      <motion.span
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.45, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="mt-3.5 block h-[2px] w-8 origin-left rounded-full"
        style={{ backgroundColor: 'var(--rep-accent, rgba(136,56,222,0.8))' }}
        aria-hidden="true"
      />
    </motion.div>
  );
}

// Approvals & sign-off block. Static in the template preview (no callbacks); in
// the report reader `onSign`/`onSignOff` make each slot manually signable and
// revocable. Signed slots record who + when. Accent tracks --rep-accent (theme
// / brand colour), so the block matches the rest of the report.
export function ReportSignoffBlock({ signatories, signoffs, onSign, onSignOff, className = '' }: {
  signatories: SignatorySlot[];
  signoffs?: Record<string, Signoff>;
  onSign?: (slot: SignatorySlot) => void;
  onSignOff?: (slot: SignatorySlot) => void;
  className?: string;
}) {
  if (!signatories.length) return null;
  const interactive = !!onSign;
  const cols = signatories.length >= 3 ? 'sm:grid-cols-3' : signatories.length === 2 ? 'sm:grid-cols-2' : 'grid-cols-1';
  return (
    <div className={className}>
      <div className="flex items-center gap-2.5 mb-4">
        <span className="w-7 h-7 rounded-md flex items-center justify-center text-white shrink-0" style={{ backgroundColor: 'var(--rep-accent, #550fa5)' }}><PenLine size={14} /></span>
        <div>
          <h2 className="text-[1.25rem] font-semibold text-ink-900 tracking-[-0.012em] leading-[1.15]">Approvals &amp; Sign-Off</h2>
          <p className="text-[0.8125rem] text-ink-500 leading-snug">Manual authorisation of this report.</p>
        </div>
      </div>
      <div className={`grid grid-cols-1 ${cols} gap-4`}>
        {signatories.map(s => {
          const signed = signoffs?.[s.id];
          const name = signed?.signedBy || s.name;
          return (
            <div key={s.id} className={`rounded-lg border p-5 transition-colors ${signed ? 'border-compliant-200 bg-compliant-50/40' : 'border-canvas-border'}`}>
              <div className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-500 mb-3">
                <PenLine size={12} /> {s.role}
              </div>
              {name ? (
                <div className="text-[0.8125rem] font-bold text-ink-900 leading-tight mb-4">{name}</div>
              ) : (
                <div className="h-5 mb-4" />
              )}
              {signed ? (
                <div className="border-t border-dashed border-compliant-300 pt-2.5">
                  <div className="flex items-center gap-1.5 text-[0.6875rem] font-semibold text-compliant-700"><Check size={12} strokeWidth={2.5} /> Signed · {signed.signedAt}</div>
                  {interactive && (
                    <button onClick={() => onSignOff?.(s)} className="mt-2 inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-ink-500 hover:text-risk-700 transition-colors cursor-pointer"><RotateCcw size={11} /> Sign off</button>
                  )}
                </div>
              ) : (
                <div className="border-t border-dashed border-canvas-border pt-2.5">
                  {interactive ? (
                    <button onClick={() => onSign?.(s)} className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md text-[0.75rem] font-semibold text-white cursor-pointer transition-opacity hover:opacity-90" style={{ backgroundColor: 'var(--rep-accent, #550fa5)' }}><PenLine size={12} /> Sign</button>
                  ) : (
                    <div className="text-[0.6875rem] italic text-ink-500 text-center">Signature / Digital Approval</div>
                  )}
                  {/* Nearly every audit sign-off carries "signed on ____", and
                      it is awkward to retrofit once reports are in print. */}
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-ink-400">Signed on</span>
                    <span className="flex-1 border-b border-dashed border-canvas-border" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// The closing page — the last slide a committee deck ends on, brought across
// as a setting rather than a section. Nothing in it is generated: the shape and
// the client's own words ARE the feature, so it prints exactly as written.
export function ReportClosingBlock({ lines, className = '' }: { lines: string[]; className?: string }) {
  const clean = lines.map(l => l.trim()).filter(Boolean);
  if (!clean.length) return null;
  return (
    <div className={`text-center py-14 ${className}`}>
      <span className="mx-auto mb-6 block h-px w-16" style={{ backgroundColor: 'var(--rep-accent, #550fa5)' }} />
      <p className="text-[1.5rem] font-semibold tracking-[-0.015em] leading-tight" style={{ color: 'var(--rep-accent, #550fa5)' }}>
        {clean[0]}
      </p>
      {clean.slice(1).map((line, i) => (
        <p key={i} className="mt-2 text-[0.875rem] text-ink-500 leading-relaxed">{line}</p>
      ))}
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
    <div className={`grid ${META_COL_CLASS[cols]} gap-x-8 gap-y-6 px-6 pt-5 pb-6`}>
      {facts.map((it, i) => (
        <motion.div
          key={it.label}
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.35, delay: Math.min(i, 6) * 0.06, ease: [0.22, 1, 0.36, 1] }}
          className="min-w-0"
        >
          <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.15em] text-ink-400 mb-2">{it.label}</div>
          <div className="text-[0.875rem] font-medium text-ink-700 leading-snug tabular-nums break-words">{it.value || '—'}</div>
        </motion.div>
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
            <div className="shrink-0 flex items-stretch rounded-lg border border-white/20 bg-white/10 overflow-hidden">
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

export function ReportBrandBanner({ title, back, actions, children, className = '', gradient, headerText, facts, footer, aside, eyebrow, titleClassName, logo }: {
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
  /** The client's brand mark (data URL), read from the report they uploaded.
   *  Sits above the title, where a real letterhead puts it, on a light chip so
   *  a dark logo stays legible on the gradient. */
  logo?: string;
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
          {logo && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="mb-3 inline-flex items-center rounded-md bg-white/92 px-2.5 py-1.5"
            >
              <img src={logo} alt="" aria-hidden="true" className="h-7 max-w-[168px] object-contain" />
            </motion.div>
          )}
          {eyebrow && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="mb-2"
            >
              {eyebrow}
            </motion.div>
          )}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            title={typeof title === 'string' ? title : undefined}
            className={`${titleClassName ?? 'text-[2rem]'} truncate font-bold tracking-[-0.02em] leading-[1.08] text-white mb-1.5`}
            style={{ textShadow: '0 1px 2px rgba(10,2,30,0.22)' }}
          >
            {title}
          </motion.h1>
          {children && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          )}
        </div>
        {aside && <div className="shrink-0 w-full sm:w-auto">{aside}</div>}
        <div className="shrink-0 flex flex-col items-end gap-3 empty:hidden">
          {headerText && (
            <span className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-white/60">{headerText}</span>
          )}
          {facts && facts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-stretch rounded-lg border border-white/20 bg-white/10 overflow-hidden"
            >
              {facts.map((f, i) => (
                <div key={f.label} className={`px-5 py-3 text-center ${i > 0 ? 'border-l border-white/15' : ''}`}>
                  <div className="text-[1.5rem] font-bold tabular-nums leading-none text-white">{f.value}</div>
                  <div className="text-[0.625rem] font-semibold uppercase tracking-wider text-white/65 mt-1.5 whitespace-nowrap">{f.label}</div>
                </div>
              ))}
            </motion.div>
          )}
          {actions && <div className="flex items-center gap-2 print:hidden">{actions}</div>}
        </div>
      </div>
      {footer && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.26, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 mt-5"
        >
          {footer}
        </motion.div>
      )}
    </div>
  );
}
