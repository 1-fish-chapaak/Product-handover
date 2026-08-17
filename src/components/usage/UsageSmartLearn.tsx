/**
 * PU-20 — Smart Learn, the assistant's memory.
 *
 * The same four numbers the Smart Learn screen computes, scoped to whoever is
 * reading: an auditor sees their own memories, a head of team sees the team tier
 * including the proposals waiting on them, a CFO sees the company. Recall count
 * and last recalled are real fields written on every use, so "is learned
 * knowledge actually being used" is measured rather than estimated.
 *
 * The empty state matters here more than anywhere else on the page: memory can be
 * switched off, and four zeros that look measured would be a lie about a feature
 * that is not running.
 */

import { ArrowRight, Check, X } from 'lucide-react';
import {
  fmtInt,
  type Scope, type SmartLearn as SmartLearnFigures,
} from '../../data/platform-usage-metrics';
import type { PlatformMemory } from '../../data/memoryStore';
import { Block, Drill, Empty, Fig, Stat, StatRow } from './usageKit';

export function SmartLearn({
  learn,
  scope,
  onOpenSmartLearn,
  onApprove,
  onReject,
}: {
  learn: SmartLearnFigures;
  scope: Scope;
  onOpenSmartLearn: () => void;
  onApprove: (memory: PlatformMemory) => void;
  onReject: (memory: PlatformMemory) => void;
}) {
  const whose = scope.persona === 'auditor' ? 'about you' : scope.persona === 'head_of_team' ? 'for your team' : 'across the company';

  if (learn.nothingYet) {
    return (
      <Block id="memory" title="What the assistant has learned" lede={null}>
        <Empty
          kind="unmeasured"
          title={`The assistant has not learned anything ${whose} yet.`}
          detail="Either memory is switched off for this workspace or nothing has been saved to it. Four zeros here would look like a measurement, so there are none."
        />
      </Block>
    );
  }

  return (
    <Block
      id="memory"
      title="What the assistant has learned"
      lede={
        <>
          The assistant is holding <Fig>{fmtInt(learn.active)}</Fig> things {whose}, and it used{' '}
          <Fig>{fmtInt(learn.usedThisWeek)}</Fig> of them in the last seven days
          {learn.pending > 0 && <>. <Fig>{fmtInt(learn.pending)}</Fig> more are waiting for somebody to approve or reject</>}
          {learn.dueReview > 0 && <>, and <Fig>{fmtInt(learn.dueReview)}</Fig> are due a review</>}.
        </>
      }
      hint="The same figures the Smart Learn screen shows, narrowed to what you can see."
      action={
        <button type="button" onClick={onOpenSmartLearn} className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-brand-700 hover:underline">
          Open Smart Learn <ArrowRight size={12} />
        </button>
      }
      table={
        <div className="space-y-4">
          <StatRow>
            <Stat value={fmtInt(learn.active)} label="Active memories" />
            <Stat value={fmtInt(learn.pending)} label="Awaiting approval" />
            <Stat value={fmtInt(learn.dueReview)} label="Due for review" />
            <Stat
              value={fmtInt(learn.usedThisWeek)}
              label="Used in the last seven days"
              sub={learn.totalRecalls === null ? undefined : `${fmtInt(learn.totalRecalls)} recalls in total`}
            />
          </StatRow>

          {learn.pendingRows.length > 0 && (
            <Drill label={`Decide the ${fmtInt(learn.pendingRows.length)} waiting on you`} hideLabel="Hide the proposals">
              <ul className="divide-y divide-canvas-border border-t border-canvas-border">
                {learn.pendingRows.map(memory => (
                  <li key={memory.id} className="py-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[0.875rem] text-ink-800">{memory.statement}</p>
                      <p className="text-[0.75rem] text-ink-500">
                        {memory.scope} · {memory.source}
                        {memory.pendingNote ? ` · ${memory.pendingNote}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onApprove(memory)}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-canvas-border text-[0.75rem] text-ink-700 hover:border-brand-200 hover:text-brand-700"
                      >
                        <Check size={13} /> Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => onReject(memory)}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-canvas-border text-[0.75rem] text-ink-700 hover:border-risk-200 hover:text-risk-700"
                      >
                        <X size={13} /> Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </Drill>
          )}
        </div>
      }
      footer="Every approval, rejection and renewal writes a row into the product's change log."
    />
  );
}
