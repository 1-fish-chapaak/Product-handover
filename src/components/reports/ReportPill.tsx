import type { ReactNode } from 'react';
import type { Tone } from '../shared/StatusBadge';

// Report-local bordered tone pill. Mirrors the canonical Pill geometry
// (DESIGN.md §7.10.4) but with the bordered treatment kept *inside* the Reports
// area, so the rest of the platform's flat chips stay untouched. Reuses the same
// tone tokens as the shared Pill for colour parity.
const PILL_CLASS: Record<Tone, string> = {
  risk:      'bg-risk-50 text-risk-700 border-risk/30',
  high:      'bg-high-50 text-high-700 border-high/30',
  mitigated: 'bg-mitigated-50 text-mitigated-700 border-mitigated/30',
  compliant: 'bg-compliant-50 text-compliant-700 border-compliant/30',
  evidence:  'bg-evidence-50 text-evidence-700 border-evidence/30',
  info:      'bg-brand-50 text-brand-700 border-brand-200',
  draft:     'bg-draft-50 text-draft-700 border-draft/30',
};

export function ReportPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center px-2.5 h-6 rounded-full border text-[0.75rem] leading-[16px] font-semibold whitespace-nowrap tabular-nums ${PILL_CLASS[tone]}`}>
      {children}
    </span>
  );
}
