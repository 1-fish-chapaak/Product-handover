/**
 * What is stuck, what keeps breaking, and what is waiting on somebody —
 * PU-10, PU-11, PU-13 and PU-14.
 *
 * These are the blocks a team lead actually acts on, so they are written to be
 * acted on: a stuck run shows the engine's own error text rather than a count to
 * click into, and every queue item reaches the thing that needs doing in one
 * click.
 *
 * The per-person table is the one place on this page where the no-ranking rule
 * could be lost, so it is held in the markup as well as in the query: fixed
 * alphabetical order, no sortable header, no share of the team, no average.
 */

import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Bars, Block, DataTable, Empty, Stat } from './usageKit';
import { fmtDuration, fmtInt, fmtPct, plural } from './usageFormat';
import { formatDateTime } from '../../data/platform-usage';
import type { PersonRow, QueueItem, ReliabilityResult, StuckRun } from '../../data/platform-usage-metrics';

/* ── PU-11 · What is stuck right now ─────────────────────────────────────── */

export function StuckRuns({ runs, onOpenRun }: { runs: StuckRun[]; onOpenRun: (id: string) => void }) {
  return (
    <Block
      title="Stuck runs"
      hint="Failed, blocked, or paused for more than a day."
    >
      {runs.length === 0 ? (
        <Empty kind="quiet" title="Nothing is stuck." />
      ) : (
        <>
          <div className="flex items-end gap-10 mb-4">
            <Stat size="md" value={fmtInt(runs.length)} label={runs.length === 1 ? 'run needs a look' : 'runs need a look'} />
          </div>
          <ul className="divide-y divide-canvas-border border-t border-canvas-border">
            {runs.slice(0, 12).map(r => (
              <li key={r.id} className="py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={14} className="text-risk-600 shrink-0" />
                      <span className="text-[0.875rem] font-medium text-ink-900 truncate">{r.workflowName}</span>
                      <span className="text-[0.75rem] text-ink-500 shrink-0">{r.status}</span>
                    </div>
                    {/* Verbatim. A summarised error is a run nobody can fix. */}
                    <p className="mt-1 text-[0.75rem] text-ink-700 font-mono break-words max-w-[80ch]">{r.error}</p>
                    <p className="mt-1 text-[0.75rem] text-ink-400 tabular-nums">
                      Started {formatDateTime(r.startedAt)} · {Math.round(r.ageHours)} hours ago · run by {r.userName}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenRun(r.id)}
                    className="shrink-0 inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-canvas-border text-[0.75rem] text-ink-600 hover:text-brand-700 hover:border-brand-200"
                  >
                    Open <ArrowRight size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {runs.length > 12 && (
            <p className="mt-2 text-[0.75rem] text-ink-400 tabular-nums">12 newest of {fmtInt(runs.length)}.</p>
          )}
        </>
      )}
    </Block>
  );
}

/* ── PU-10 · Reliability ─────────────────────────────────────────────────── */

export function Reliability({ data }: { data: ReliabilityResult }) {
  const failing = data.rows.filter(r => r.failed > 0);

  return (
    <Block
      title="Reliability"
      hint="Failure rate per workflow, and the machine time failed runs burned."
      chart={
        data.rows.length === 0 ? (
          <Empty kind="quiet" title="No workflow ran in this window." />
        ) : failing.length === 0 ? (
          <Empty kind="quiet" title="Nothing failed in this window." detail={`${plural(data.rows.length, 'workflow', 'workflows')} ran, every run completed.`} />
        ) : (
          <>
            <Bars
              rows={failing.map(r => ({
                label: r.name,
                value: r.failurePct,
                note: `${r.failed} of ${r.total} runs`,
              }))}
              format={v => fmtPct(v)}
              tone="risk"
            />
            <p className="mt-4 text-[0.75rem] text-ink-500 tabular-nums">
              {plural(data.failedRuns, 'failed run', 'failed runs')} burned {fmtDuration(data.wastedHours)} of
              machine time, never counted as saved.
            </p>
          </>
        )
      }
      table={
        <DataTable
          head={['Workflow', 'Failed', 'Runs', 'Failure rate']}
          rows={data.rows.map(r => [r.name, fmtInt(r.failed), fmtInt(r.total), fmtPct(r.failurePct)])}
        />
      }
    />
  );
}

/* ── PU-13 · The team, alphabetically ────────────────────────────────────── */

/**
 * People are never ranked.
 *
 * No sortable header, no share of the team's work, no rank, no average. Somebody
 * with no runs still appears, which is the difference between a team list and a
 * leaderboard. "You ran 62, the team average is 51" is a ranking through the
 * back door and is equally out.
 */
export function PerPersonOutcomes({ rows, team }: { rows: PersonRow[]; team: string }) {
  return (
    <Block
      title="Per-person outcomes"
      hint={`Everyone in ${team}, alphabetical, and it stays that way. Nothing here ranks anybody.`}
    >
      {rows.length === 0 ? (
        <Empty kind="quiet" title="Nobody is on this team yet." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[0.875rem]">
            <thead>
              <tr className="border-b border-canvas-border">
                {['Name', 'Runs', 'Exceptions found', 'Waiting on them'].map((h, i) => (
                  <th
                    key={h}
                    scope="col"
                    aria-sort="none"
                    className={`py-2 text-[0.75rem] font-semibold uppercase tracking-wide text-ink-400 ${i === 0 ? 'text-left' : 'text-right'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.name} className="border-b border-canvas-border last:border-0">
                  <td className="py-2 text-ink-900">{r.name}</td>
                  <td className="py-2 text-right tabular-nums text-ink-800">{fmtInt(r.runs)}</td>
                  <td className="py-2 text-right tabular-nums text-ink-800">{fmtInt(r.exceptions)}</td>
                  <td className="py-2 text-right tabular-nums text-ink-800">{fmtInt(r.waiting)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Block>
  );
}

/* ── PU-14 · My queue ────────────────────────────────────────────────────── */

export function MyQueue({ items, onOpen }: { items: QueueItem[]; onOpen: (item: QueueItem) => void }) {
  const overdue = items.filter(i => i.overdue).length;

  return (
    <Block
      title="My queue"
      hint="Overdue first. Every item opens what needs doing."
    >
      {items.length === 0 ? (
        <Empty kind="quiet" title="You are clear." />
      ) : (
        <>
          <div className="flex items-end gap-10 mb-4">
            <Stat size="md" value={fmtInt(items.length)} label={items.length === 1 ? 'thing waiting on you' : 'things waiting on you'} />
            {overdue > 0 && <Stat size="sm" value={fmtInt(overdue)} label="open for a week or more" />}
          </div>
          <ul className="divide-y divide-canvas-border border-t border-canvas-border">
            {items.map(i => (
              <li key={`${i.kind}-${i.id}`}>
                <button type="button" onClick={() => onOpen(i)} className="w-full text-left py-3 group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <span className="text-[0.875rem] text-ink-900 group-hover:text-brand-700">{i.title}</span>
                      <p className="mt-0.5 text-[0.75rem] text-ink-500">{i.detail}</p>
                    </div>
                    <span className="shrink-0 text-[0.75rem] text-ink-400 tabular-nums">
                      {i.kind === 'Exception'
                        ? i.ageDays === 0 ? 'today' : plural(i.ageDays, 'day old', 'days old')
                        : i.kind}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Block>
  );
}
