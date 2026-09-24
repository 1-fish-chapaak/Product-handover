import { Ban, CircleCheck, Loader2, XCircle } from 'lucide-react';
import type { BatchTone } from './useWorkflowBatch';

// Bordered, tinted pill with a small icon — the same grammar as the bulk
// wizard's step badges.
const CONFIG: Record<BatchTone, { cls: string; label: string }> = {
  started: { cls: 'border-brand-200 bg-brand-50 text-brand-700', label: 'Running' },
  updating: { cls: 'border-brand-200 bg-brand-50 text-brand-700', label: 'Updating dashboard…' },
  done: { cls: 'border-compliant-200 bg-compliant-50 text-compliant-700', label: 'Dashboard updated' },
  skipped: { cls: 'border-canvas-border bg-canvas text-ink-600', label: 'Skipped' },
  failed: { cls: 'border-risk-200 bg-risk-50 text-risk-700', label: 'Failed' },
};

/** Status pill for one workflow of a batch. */
export default function RunStatusPill({ tone }: { tone: BatchTone }) {
  const { cls, label } = CONFIG[tone];
  const spinning = tone === 'started' || tone === 'updating';
  return (
    <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium shrink-0 ${cls}`} data-testid={`batch-status-${tone}`}>
      {spinning && <Loader2 size={11} strokeWidth={2.5} className="animate-spin" />}
      {tone === 'done' && <CircleCheck size={11} strokeWidth={2.5} />}
      {tone === 'skipped' && <Ban size={11} strokeWidth={2.5} />}
      {tone === 'failed' && <XCircle size={11} strokeWidth={2.5} />}
      {label}
    </span>
  );
}
