// ATR-style document chrome shared by every generated-report surface
// (standard reports, bulk-audit reports). Mirrors AtrDocument.tsx proportions:
// brand banner, metadata grid, numbered sections, KPI tile grid.

import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { KpiCountUp } from '../shared/KpiTile';
import { statTone } from './reportTones';

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
          <h2 className="text-[1.0625rem] font-bold text-ink-900 tracking-tight leading-tight">{title}</h2>
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

export function ReportBrandBanner({ title, actions, children, className = '' }: {
  title: string;
  /** CTAs rendered top-right on the banner, like the ATR document. */
  actions?: React.ReactNode;
  /** Description / byline content rendered under the title. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative px-9 py-7 bg-gradient-to-br from-brand-700 to-brand-600 text-white overflow-hidden ${className}`}>
      <div className="absolute -right-6 -top-10 w-48 h-48 rounded-full bg-white/5" aria-hidden="true" />
      <div className="relative flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-[8px] bg-white/15 flex items-center justify-center"><Sparkles size={15} /></div>
            <div className="leading-none">
              <div className="text-[0.8125rem] font-bold tracking-wide">IRAME.AI</div>
              <div className="text-[0.5rem] font-semibold tracking-[0.22em] text-white/70 mt-0.5">AUDIT INTELLIGENCE</div>
            </div>
          </div>
          <h1 className="text-[1.75rem] font-bold tracking-tight leading-tight mb-1">{title}</h1>
          {children}
        </div>
        {actions && <div className="shrink-0 flex items-center gap-2 print:hidden">{actions}</div>}
      </div>
    </div>
  );
}
