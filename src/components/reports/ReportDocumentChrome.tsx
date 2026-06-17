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

export function ReportKpiTiles({ stats, animate = false }: { stats: ReportStat[]; animate?: boolean }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((stat, si) => {
        const tone = statTone(stat.color);
        const cls = `rounded-[10px] border border-canvas-border border-l-[3px] ${tone.border} bg-canvas-elevated p-4`;
        const inner = (
          <>
            <div className={`text-[1.625rem] font-bold tabular-nums leading-none mb-1 ${tone.text}`}>
              {animate ? <KpiCountUp value={stat.value} delay={120 + si * 80} /> : stat.value}
            </div>
            <div className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-600 leading-tight">{stat.label}</div>
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
  return (
    <div className="flex items-start justify-between gap-3 mb-5">
      <div className="flex items-start gap-3 min-w-0">
        <span className="shrink-0 w-7 h-7 rounded-full bg-brand-50 text-brand-700 text-[0.8125rem] font-bold flex items-center justify-center mt-0.5">{n}</span>
        <div className="min-w-0">
          <h2 className="text-[1.1875rem] font-semibold text-ink-900 tracking-tight leading-tight">{title}</h2>
          {subtitle && <p className="text-[0.75rem] text-ink-500">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
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

// Metadata as a structured, bordered panel with internal dividers, so the facts
// read as a single report-info table rather than cells floating in a wide band.
// Empty-value facts are dropped, and the column count auto-fits the remaining
// facts (single row up to 4) unless an explicit `columns` is given. Divider
// edges are computed per item so any count stays clean.
const META_COL_CLASS: Record<number, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' };
export function ReportMetaPanel({ items, columns }: { items: { label: string; value?: string }[]; columns?: 1 | 2 | 3 | 4 }) {
  const facts = items.filter(it => it.value);
  if (facts.length === 0) return null;
  const cols = columns ?? (facts.length <= 4 ? facts.length : 3);
  const lastRowStart = facts.length - (facts.length % cols || cols);
  return (
    <div className={`grid ${META_COL_CLASS[cols]} border border-canvas-border rounded-[10px] overflow-hidden bg-canvas-elevated`}>
      {facts.map((it, i) => {
        const isLastCol = i % cols === cols - 1;
        const hasRightNeighbor = !isLastCol && i + 1 < facts.length;
        const isLastRow = i >= lastRowStart;
        return (
          <div key={it.label} className={`px-5 py-3.5 border-canvas-border ${hasRightNeighbor ? 'border-r' : ''} ${isLastRow ? '' : 'border-b'}`}>
            <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-500 mb-1.5">{it.label}</div>
            <div className="border-l-[3px] border-brand-500 pl-3">
              <div className="text-[0.8125rem] font-bold text-ink-900 leading-snug">{it.value || '—'}</div>
            </div>
          </div>
        );
      })}
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
          <div className="flex items-center gap-2 text-[13px] flex-wrap">{byline}</div>
          {actions && <div className="flex items-center gap-2 print:hidden">{actions}</div>}
        </div>
      </div>
    </div>
  );
}

export function ReportBrandBanner({ title, actions, children, className = '', gradient, headerText, facts }: {
  title: string;
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
}) {
  // Purple gradient letterhead — title + byline over floating-line art, with
  // actions stacked top-right. A template's theme gradient overrides the default.
  const [from, to] = gradient ?? ['#3b0b72', '#6a12cd'];
  return (
    <div
      className={`relative overflow-hidden px-9 pt-9 pb-8 ${className}`}
      style={{ backgroundImage: `linear-gradient(125deg, ${from} 0%, ${to} 62%, ${to} 100%)` }}
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
        <FloatingLines enabledWaves={['top', 'middle', 'bottom']} lineCount={[7, 8, 7]} lineDistance={5} interactive={false} parallax={false} color="#c084fc" opacity={0.22} />
        <FloatingLines enabledWaves={['top', 'middle']} lineCount={6} lineDistance={7} interactive={false} parallax={false} color="#f5d0fe" opacity={0.4} />
      </div>
      {/* Readability scrim — darkens the left, where the title and byline sit,
          so text keeps full contrast while the weave stays dense on the right. */}
      <div
        className="absolute inset-0 z-0"
        style={{ backgroundImage: 'linear-gradient(to right, rgba(17,5,42,0.48), rgba(17,5,42,0.14) 40%, rgba(17,5,42,0) 62%)' }}
        aria-hidden="true"
      />
      <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <h1 className="text-[2rem] font-semibold tracking-tight leading-tight text-white mb-1.5">{title}</h1>
          {children}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-3">
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
    </div>
  );
}
