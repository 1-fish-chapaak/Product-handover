/**
 * Shared building blocks for the Platform Usage deep-dive sections.
 *
 * The visual vocabulary now lives in `usageChrome.tsx` (components) and
 * `usageTokens.ts` (constants). What remains here is the section-specific
 * shapes: the section shell and the stat strip inside a deep-dive modal.
 */

import type { LucideIcon } from 'lucide-react';
import { Card } from './usageChrome';

export function SectionCard({ icon, title, subtitle, right, className = '', children }: {
  icon: LucideIcon; title: string; subtitle?: string; right?: React.ReactNode; className?: string; children: React.ReactNode;
}) {
  return (
    <Card icon={icon} title={title} subtitle={subtitle} right={right} className={className}>
      {children}
    </Card>
  );
}

/* ── Small stat within a section's portfolio strip ──
   No border and no card: inside a modal these sat as boxes within a box within
   a box.

   No leading rule either. A `border-l` on every stat draws a hairline down the
   left of the *first* column too, which reads as a stray tick floating beside
   the opening number rather than as a divider between anything. The grid gap
   already groups them. */
export function PortfolioStat({ label, value, sub, tone }: {
  label: string; value: string; sub?: string; tone?: 'good' | 'bad' | 'neutral';
}) {
  const color = tone === 'good' ? 'text-compliant-700' : tone === 'bad' ? 'text-risk-700' : 'text-ink-900';
  return (
    <div>
      <div className={`text-[1.5rem] font-semibold tracking-[-0.02em] tabular-nums leading-none ${color}`}>{value}</div>
      <div className="mt-2 text-[0.75rem] font-medium text-ink-600 truncate">{label}</div>
      {sub && <div className="mt-0.5 text-[0.6875rem] text-ink-400 truncate">{sub}</div>}
    </div>
  );
}
