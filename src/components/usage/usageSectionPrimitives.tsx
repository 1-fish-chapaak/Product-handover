/**
 * Shared building blocks for the Platform Usage deep-dive sections.
 *
 * Every section (Engagements, Reports, Workflows, …) renders the same visual
 * language: a SectionCard shell, a PortfolioStat strip, and read-only bars /
 * donuts / ranked rows. Extracted here so all sections stay identical.
 */

import type { LucideIcon } from 'lucide-react';

export const fmt = (n: number) => n.toLocaleString('en-US');

export const CARD = 'rounded-xl border border-canvas-border/70 bg-canvas-elevated shadow-[0_1px_2px_rgb(15_15_20_/_0.04),_0_4px_12px_rgb(15_15_20_/_0.03)]';

export function SectionCard({ icon: Icon, title, subtitle, right, className = '', children }: {
  icon: LucideIcon; title: string; subtitle?: string; right?: React.ReactNode; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={`${CARD} overflow-hidden flex flex-col ${className}`}>
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-canvas-border/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={14} className="text-ink-500 shrink-0" strokeWidth={1.75} />
          <h3 className="text-[0.75rem] font-semibold text-ink-900 truncate">{title}</h3>
          {subtitle && <span className="hidden md:inline text-[0.6875rem] text-ink-400 truncate">· {subtitle}</span>}
        </div>
        {right}
      </div>
      <div className="flex-1 p-5">{children}</div>
    </div>
  );
}

/* ── Small stat within a section's portfolio strip ── */
export function PortfolioStat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' | 'neutral' }) {
  const color = tone === 'good' ? 'text-compliant-700' : tone === 'bad' ? 'text-risk-700' : 'text-ink-900';
  return (
    <div className="rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-3">
      <div className={`text-[1.375rem] font-bold tabular-nums leading-none ${color}`}>{value}</div>
      <div className="text-[0.6875rem] text-ink-600 font-medium mt-1.5 truncate">{label}</div>
      {sub && <div className="text-[0.625rem] text-ink-400 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}
