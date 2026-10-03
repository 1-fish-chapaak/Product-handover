/**
 * Builds & reviews — every batch build in one place.
 *
 * A batch used to live only inside the chat that started it, so leaving the
 * chat lost every "Review ↗" link while Ira kept building out of sight. This
 * page lists all of them, newest first, with what needs the user on top:
 * files Ira couldn't find, and workflows waiting for review.
 */
import { useState } from 'react';
import { ArrowUpRight, CircleDashed, Check, Loader2, Sparkles, Layers } from 'lucide-react';
import { Button } from '../shared/Button';
import { fmtHours, itemHours, pendingItems, sessionHref, useAllBatches } from '../../data/auditPlan';
import { BatchBuildCard } from '../chat/BatchBuildCards';

interface Props {
  onOpenEngagement: (id: string) => void;
  onOpenLibrary: () => void;
  onOpenControls: () => void;
  onAuditWithAi: () => void;
}

export default function BuildsView({ onOpenEngagement, onOpenLibrary, onOpenControls, onAuditWithAi }: Props) {
  const batches = useAllBatches();
  const { needsInput, toReview, building } = pendingItems(batches);
  const [tab, setTab] = useState<'needs' | 'all'>(needsInput.length + toReview.length > 0 ? 'needs' : 'all');
  const shown = tab === 'all'
    ? batches
    : batches.filter(b => b.items.some(i => i.status === 'ready' || (i.status === 'needs-input' && !i.answer?.startsWith('Leave'))));
  const first = toReview[0] ?? needsInput[0];
  const reviewHours = toReview.reduce((s, x) => s + itemHours(x.item), 0);

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="max-w-[60rem] mx-auto px-6 md:px-10 pt-8 pb-24">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
          <div>
            <h1 className="text-[1.5rem] font-semibold tracking-tight text-ink-900">Builds & reviews</h1>
            <p className="text-[0.8125rem] text-ink-500 mt-0.5">Everything Ira built for you — answer what it's stuck on, review what's ready.</p>
          </div>
          {first && (
            <a
              href={sessionHref(first.item.sessionId)}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary text-white text-[0.8125rem] font-semibold hover:bg-primary-hover"
            >
              Start reviewing <ArrowUpRight size={14} />
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {[
            { icon: CircleDashed, tone: 'text-mitigated-700', v: needsInput.length, l: 'need your input', sub: needsInput.length ? 'Usually one missing file' : 'Nothing blocked' },
            { icon: Check, tone: 'text-compliant-700', v: toReview.length, l: 'ready to review', sub: toReview.length ? `+${fmtHours(reviewHours)}/mo once approved (est.) · ~${toReview.length * 2} min` : 'All caught up' },
            { icon: Loader2, tone: 'text-brand-600', v: building.length, l: 'building', sub: building.length ? 'Keeps going while you work' : 'Idle' },
          ].map(k => (
            <div key={k.l} className="rounded-lg border border-canvas-border bg-canvas-elevated p-4">
              <div className="flex items-center gap-2">
                <k.icon size={15} className={`${k.tone} ${k.icon === Loader2 && k.v > 0 ? 'animate-spin' : ''}`} aria-hidden />
                <span className="font-mono tabular-nums text-[1.5rem] font-semibold text-ink-900 leading-none">{k.v}</span>
                <span className="text-[0.8125rem] text-ink-600">{k.l}</span>
              </div>
              <div className="mt-1.5 text-[0.75rem] text-ink-500">{k.sub}</div>
            </div>
          ))}
        </div>

        <div role="tablist" className="flex items-center gap-1 mb-4">
          {([['needs', 'Needs you'], ['all', 'All builds']] as const).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`h-8 px-3 rounded-full text-[0.8125rem] font-medium cursor-pointer ${tab === id ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-paper-100'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <div className="rounded-lg border border-dashed border-canvas-border px-6 py-14 text-center">
            <Layers size={20} className="mx-auto text-ink-300" aria-hidden />
            <p className="mt-2 text-[0.875rem] font-medium text-ink-800">{batches.length === 0 ? 'Nothing built yet' : 'Nothing needs you'}</p>
            <p className="text-[0.8125rem] text-ink-500">Adapt standard workflows to your data, or let Ira plan an audit.</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="primary" size="sm" leftIcon={<Sparkles size={13} />} onClick={onOpenControls}>Adapt standard library</Button>
              <Button variant="outline" size="sm" onClick={onAuditWithAi}>Audit with AI</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {shown.map(b => (
              <div key={b.id}>
                <div className="text-[0.6875rem] text-ink-400 mb-1.5 tabular-nums">
                  {new Date(b.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {b.owner ? ` · started by ${b.owner}` : ''}
                </div>
                <BatchBuildCard
                  batchId={b.id}
                  onOpenEngagement={onOpenEngagement}
                  onOpenLibrary={onOpenLibrary}
                  onOpenControls={onOpenControls}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
