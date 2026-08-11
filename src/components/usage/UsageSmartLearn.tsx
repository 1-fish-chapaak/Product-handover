/**
 * PU-20 · Smart Learn — what the assistant has learned, and whether it is used.
 *
 * The four numbers here are the same four the Smart Learn screen computes, read
 * off the same store and scoped to whoever is looking. Recall count and last
 * recalled are real fields written every time a memory is attached to a
 * question, so "is learned knowledge actually being used" is measured rather
 * than inferred.
 *
 * Pending proposals appear only for somebody who can approve them, and the
 * decision is made here rather than sending the reader to another screen: a
 * proposal that takes two navigations to approve sits pending forever.
 */

import { Block, Empty, Stat } from './usageKit';
import { fmtInt } from './usageFormat';
import type { SmartLearnResult } from '../../data/platform-usage-metrics';

export function SmartLearn({
  data,
  scopeLabel,
  onDecide,
  onManage,
}: {
  data: SmartLearnResult;
  scopeLabel: string;
  onDecide?: (id: string, decision: 'approve' | 'reject') => void;
  onManage: () => void;
}) {
  return (
    <Block
      title="What the assistant has learned"
      hint={scopeLabel}
      action={
        <button
          type="button"
          onClick={onManage}
          className="h-7 px-2.5 rounded-md border border-canvas-border text-[0.75rem] text-ink-600 hover:text-brand-700 hover:border-brand-200"
        >
          Open Smart Learn
        </button>
      }
    >
      {!data.hasData ? (
        <Empty
          kind="quiet"
          title="The assistant has not learned anything for this scope yet."
          action={{ label: 'Open Smart Learn', onClick: onManage }}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-x-12 gap-y-5">
            <Stat size="md" value={fmtInt(data.active)} label="memories in use" />
            <Stat size="sm" value={fmtInt(data.recalls7d)} label="recalled in the last 7 days" />
            <Stat size="sm" value={fmtInt(data.dueReview)} label="due for review" />
            {data.pending > 0 && <Stat size="sm" value={fmtInt(data.pending)} label="waiting for approval" />}
          </div>

          {data.awaitingMe.length > 0 && (
            <div className="mt-5 pt-4 border-t border-canvas-border">
              <h4 className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-400">
                Waiting for your decision
              </h4>
              <ul className="mt-2 divide-y divide-canvas-border">
                {data.awaitingMe.map(m => (
                  <li key={m.id} className="py-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[0.875rem] text-ink-900">{m.statement}</p>
                      <p className="mt-0.5 text-[0.75rem] text-ink-500">{m.note}</p>
                    </div>
                    {onDecide && (
                      <div className="shrink-0 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onDecide(m.id, 'reject')}
                          className="h-7 px-2.5 rounded-md border border-canvas-border text-[0.75rem] text-ink-600 hover:text-ink-900"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => onDecide(m.id, 'approve')}
                          className="h-7 px-2.5 rounded-md bg-brand-600 text-white text-[0.75rem] font-medium hover:bg-brand-700"
                        >
                          Approve
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Block>
  );
}
