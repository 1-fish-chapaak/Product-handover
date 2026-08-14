/**
 * PU-20 · Smart Learn — what the assistant has learned, and whether it is used.
 *
 * The four numbers here are the same four the Smart Learn screen computes, read
 * off the same store and scoped to whoever is looking. Recall count and last
 * recalled are real fields written every time a memory is attached to a
 * question, so "is learned knowledge actually being used" is measured rather
 * than inferred.
 *
 * The count of proposals waiting for approval appears only for somebody who can
 * approve them, and it is a count, not a queue. Approving and rejecting live on
 * the Smart Learn screen, which is the one place that decision is made; a second
 * pair of buttons here would be a second place to keep right, and this page
 * reports rather than acts.
 */

import { Block, Empty, Stat } from './usageKit';
import { fmtInt } from './usageFormat';
import type { SmartLearnResult } from '../../data/platform-usage-metrics';

export function SmartLearn({
  data,
  scopeLabel,
  onManage,
}: {
  data: SmartLearnResult;
  scopeLabel: string;
  onManage: () => void;
}) {
  return (
    <Block
      title="Smart Learn"
      hint={`Memory in use · ${scopeLabel}`}
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

          {data.pending > 0 && (
            <p className="mt-3 text-[0.75rem] text-ink-500">
              {data.pending === 1 ? 'One proposal is' : `${fmtInt(data.pending)} proposals are`} waiting on a
              decision. Approve or reject them in Smart Learn.
            </p>
          )}

        </>
      )}
    </Block>
  );
}
