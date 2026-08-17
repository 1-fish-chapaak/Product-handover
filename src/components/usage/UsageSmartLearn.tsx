/**
 * PU-20 · Smart Learn — what the assistant has learned, and whether it is used.
 *
 * The four numbers here are the same four the Smart Learn screen computes, read
 * off the same store and scoped to whoever is looking. Recall count and last
 * recalled are real fields written every time a memory is attached to a
 * question, so "is learned knowledge actually being used" is measured rather
 * than inferred.
 *
 * Proposals waiting for approval are shown to the person who can decide them,
 * and they are decided here: somebody who opens this page to see what is stuck
 * should not have to go somewhere else to clear the one thing waiting on them.
 * Approving and rejecting write the same audit event the Smart Learn screen
 * writes, because it is the same store underneath.
 */

import { Block, Empty, Fig, Stat } from './usageKit';
import { fmtInt, plural } from './usageFormat';
import type { SmartLearnResult } from '../../data/platform-usage-metrics';
import type { PlatformMemory } from '../../data/memoryStore';

export function SmartLearn({
  data,
  scopeLabel,
  onManage,
  onApprove,
  onReject,
}: {
  data: SmartLearnResult;
  scopeLabel: string;
  onManage: () => void;
  /** Only passed to a reader who may decide a proposal. */
  onApprove?: (m: PlatformMemory) => void;
  onReject?: (m: PlatformMemory) => void;
}) {
  const canDecide = Boolean(onApprove && onReject);

  return (
    <Block
      title="Smart Learn"
      hint={`Memory in use · ${scopeLabel}`}
      lede={
        !data.hasData ? null : (
          <>
            The assistant is holding <Fig>{plural(data.active, 'memory', 'memories')}</Fig> at this scope and
            used <Fig>{fmtInt(data.recalls7d)}</Fig> of them in the last 7 days
            {data.pending > 0 && <>, with <Fig>{fmtInt(data.pending)}</Fig> waiting on a decision</>}.
          </>
        )
      }
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

          {/* A memory spreads only through approval, so the decision is made on
              a named sentence, never on a count. */}
          {canDecide && data.proposals.length > 0 && (
            <ul className="mt-4 divide-y divide-canvas-border border-t border-canvas-border">
              {data.proposals.map(m => (
                <li key={m.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[0.875rem] text-ink-800">{m.statement}</p>
                    <p className="mt-0.5 text-[0.75rem] text-ink-500">
                      {m.pendingNote ?? 'Waiting for a decision before the assistant uses it'}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onReject?.(m)}
                      className="h-7 px-2.5 rounded-md border border-canvas-border text-[0.75rem] text-ink-600 hover:text-risk-700 hover:border-risk-200"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => onApprove?.(m)}
                      className="h-7 px-2.5 rounded-md bg-brand-600 text-white text-[0.75rem] font-medium hover:bg-brand-700"
                    >
                      Approve
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Block>
  );
}
