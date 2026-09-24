import { TrendingUp, TrendingDown, Minus, Plus } from 'lucide-react';

export type DeltaTone = 'good' | 'bad' | 'neutral';

/** Tone classes shared with RunTrajectoryBand / follow-up insights, in rem. */
const DELTA_CHIP_CLS: Record<DeltaTone, string> = {
  good: 'text-compliant-700 bg-compliant-50',
  bad: 'text-risk-700 bg-risk-50',
  neutral: 'text-ink-600 bg-canvas border border-canvas-border',
};

/**
 * A movement, said three ways at once — arrow, sign and words — so colour is
 * never the only carrier. `text` is the visible label ("+12%", "±0", "new");
 * `polarityHint` is appended to the accessible name ("lower is better").
 */
export default function DeltaChip({ text, tone, direction, size = 'sm', polarityHint, className = '', isNew = false }: {
  text: string;
  tone: DeltaTone;
  /** Which way the number moved; drives the icon. */
  direction: 'up' | 'down' | 'flat';
  size?: 'sm' | 'md';
  polarityHint?: string;
  className?: string;
  /** A came in at zero — the chip reads "new" with a plus icon. */
  isNew?: boolean;
}) {
  const Icon = isNew ? Plus : direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;
  const words = isNew ? 'new in the second period' : direction === 'up' ? `up ${text.replace(/^[+−-]/, '')}` : direction === 'down' ? `down ${text.replace(/^[+−-]/, '')}` : 'no change';
  const toneCls = isNew ? 'text-evidence-700 bg-evidence-50' : DELTA_CHIP_CLS[tone];
  return (
    <span
      role="img"
      aria-label={`${words}${polarityHint ? `, ${polarityHint}` : ''}`}
      className={`inline-flex items-center gap-0.5 rounded-xs font-bold tabular-nums whitespace-nowrap ${size === 'sm' ? 'h-5 px-1.5 text-[0.6875rem]' : 'h-6 px-2 text-[0.75rem]'} ${toneCls} ${className}`}
    >
      <Icon size={size === 'sm' ? 10 : 12} aria-hidden="true" />
      {text}
    </span>
  );
}
