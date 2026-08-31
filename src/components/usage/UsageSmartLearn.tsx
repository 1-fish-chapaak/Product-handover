/**
 * PU-20. What the assistant has learned, and how much of it is being used.
 *
 * The same four numbers the Smart Learn screen computes, scoped to whoever is
 * reading: an auditor sees their own memories, a team lead sees the team tier
 * including proposals waiting on their approval, the whole-company view sees
 * everything.
 *
 * There are no approve and reject buttons here. An earlier draft put them on
 * this block, which contradicts the page's own rule: it reads, it never writes.
 * The pending count is shown and it links to Smart Learn, where approving
 * already has its own confirmation and its own audit trail. Same rule
 * everywhere on this page. It may link to an action; it never performs one.
 */

import { fmtInt, openLabel, type LearnFigures, type Scope } from '../../data/platform-usage-metrics';
import { Block, Drill, Empty, Fig, MadeList, MadeRow, Stat, StatRow } from './usageKit';

export function SmartLearn({
  learn, scope, onOpenSmartLearn,
}: {
  learn: LearnFigures;
  scope: Scope;
  onOpenSmartLearn: () => void;
}) {
  const mine = scope.persona === 'auditor';
  const title = mine ? 'What the assistant has learned about you' : 'What the assistant has learned';

  // Memory switched off, or nothing learned yet. Four zeros would look measured,
  // and the assistant not having learned anything is a different fact.
  if (learn.active.length === 0 && learn.pending.length === 0) {
    return (
      <Block id="memory" title={title} lede={null}>
        <Empty
          kind="quiet"
          title={`The assistant hasn't learned anything for ${mine ? 'you' : scope.subject} yet.`}
          detail="It saves what somebody tells it about how they work, and a team rule only ever goes live once a person approves it."
        />
      </Block>
    );
  }

  return (
    <Block
      id="memory"
      title={title}
      lede={
        learn.pending.length > 0
          ? (
            <>
              <Fig>{fmtInt(learn.active.length)}</Fig>{' '}
              {learn.active.length === 1 ? 'thing is' : 'things are'} in use, and{' '}
              <Fig>{fmtInt(learn.pending.length)}</Fig>{' '}
              {learn.pending.length === 1 ? 'is' : 'are'} waiting for somebody to approve{' '}
              {learn.pending.length === 1 ? 'it' : 'them'}.
            </>
          )
          : (
            <>
              <Fig>{fmtInt(learn.active.length)}</Fig>{' '}
              {learn.active.length === 1 ? 'thing is' : 'things are'} in use and nothing is waiting on
              approval.
            </>
          )
      }
      action={
        <button type="button" onClick={onOpenSmartLearn} className="text-[0.75rem] font-medium text-brand-700 hover:underline">
          Open Smart Learn
        </button>
      }
    >
      <StatRow>
        <Stat label="In use" value={fmtInt(learn.active.length)} />
        <Stat label="Awaiting approval" value={fmtInt(learn.pending.length)} />
        <Stat label="Due for review" value={fmtInt(learn.dueReview)} />
        <Stat
          label="Recalled in the last 7 days"
          value={learn.recallsThisWeek === null ? '—' : fmtInt(learn.recallsThisWeek)}
          sub={
            learn.recallsThisWeek === null
              ? 'Recorded for the whole company only, so there is no figure at this scope.'
              : 'Counted on each use, not estimated.'
          }
        />
      </StatRow>

      {learn.pending.length > 0 && (
        <div className="mt-4">
          <Drill label={openLabel(learn.pending.length, 'waiting for approval', 'waiting for approval')}>
            <MadeList>
              {learn.pending.map(memory => (
                <MadeRow
                  key={memory.id}
                  name={memory.statement}
                  madeBy={memory.source}
                  when={memory.learnedOn}
                  note="approve or reject it in Smart Learn"
                  onOpen={onOpenSmartLearn}
                />
              ))}
            </MadeList>
          </Drill>
        </div>
      )}

      {learn.active.length > 0 && (
        <div className="mt-2">
          <Drill label={openLabel(learn.active.length, 'in use', 'in use')}>
            <MadeList>
              {learn.active.map(memory => (
                <MadeRow
                  key={memory.id}
                  name={memory.statement}
                  madeBy={memory.approvedBy ?? memory.source}
                  when={memory.approvedOn ?? memory.learnedOn}
                  note={`recalled ${fmtInt(memory.recallCount ?? 0)} times`}
                />
              ))}
            </MadeList>
          </Drill>
        </div>
      )}

      <p className="mt-3 text-[0.75rem] text-ink-500 leading-relaxed max-w-[80ch]">
        Approving is a decision with its own record, so it happens in Smart Learn. This page only
        reads.
      </p>
    </Block>
  );
}
