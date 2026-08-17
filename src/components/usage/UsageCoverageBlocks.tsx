/**
 * What the automation reached — PU-06, PU-07 and PU-08.
 *
 * Coverage answers "how much of the control library has the platform actually
 * exercised", and its companion answers the harder question: which controls has
 * nothing ever checked. The second one ignores the period on purpose. "Nothing
 * has ever tested this" is a fact about the library rather than about a window,
 * and it rests on no setting at all, which makes it the one figure on this page
 * that cannot be argued with.
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { Bars, Block, DataTable, Empty, Fig, Stat } from './usageKit';
import { fmtInt, fmtPct, plural, formatWhen } from './usageFormat';
import type { CoverageResult, ExceptionsResult, NeverExercised } from '../../data/platform-usage-metrics';

/* ── PU-06 · Control coverage ────────────────────────────────────────────── */

export function ControlCoverage({ coverage }: { coverage: CoverageResult }) {
  return (
    <Block
      title="Control coverage"
      hint="A control checked fifty times counts once."
      lede={
        coverage.total === 0 ? null : (
          <>
            The platform has exercised <Fig>{fmtPct(coverage.pct)}</Fig> of the control library in this window,{' '}
            <Fig>{fmtInt(coverage.exercised)}</Fig> of {fmtInt(coverage.total)} controls.
          </>
        )
      }
    >
      {coverage.total === 0 ? (
        <Empty kind="quiet" title="There are no controls in the library yet." />
      ) : (
        <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
          <Stat
            size="md"
            value={fmtPct(coverage.pct)}
            label={`${fmtInt(coverage.exercised)} of ${fmtInt(coverage.total)} controls`}
          />
          <div className="flex-1 min-w-[16rem]">
            <div className="h-2 rounded-full bg-canvas overflow-hidden" role="img"
                 aria-label={`${fmtInt(coverage.exercised)} of ${fmtInt(coverage.total)} controls exercised`}>
              <div className="h-full rounded-full bg-brand-600" style={{ width: `${coverage.pct}%` }} />
            </div>
            {coverage.names.length > 0 && (
              <p className="mt-2 text-[0.75rem] text-ink-400 truncate">
                {coverage.names.slice(0, 3).join(', ')}
                {coverage.names.length > 3 && ` +${coverage.names.length - 3}`}
              </p>
            )}
          </div>
        </div>
      )}
    </Block>
  );
}

/* ── PU-07 · Never exercised, ever ───────────────────────────────────────── */

export function NeverExercisedBlock({
  data,
  onOpenControls,
  onOpenWorkflows,
}: {
  data: NeverExercised;
  onOpenControls: () => void;
  onOpenWorkflows: () => void;
}) {
  const [open, setOpen] = useState(false);
  const nothing = data.controls.length === 0 && data.workflows.length === 0;

  return (
    <Block
      title="Never exercised"
      hint="Ignores the period. Never exercised at all, in the whole record."
      lede={
        nothing ? null : (
          <>
            <Fig>{plural(data.controls.length, 'control has', 'controls have')}</Fig> never been tested by anything
            and <Fig>{plural(data.workflows.length, 'workflow has', 'workflows have')}</Fig> never run, in the
            whole record.
          </>
        )
      }
    >
      {nothing ? (
        <Empty kind="quiet" title="Every control has been checked at least once." />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
            <button
              type="button"
              onClick={() => setOpen(v => !v)}
              className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-brand-700 hover:underline"
            >
              {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              {open ? 'Hide the list' : 'Name them'}
            </button>
          </div>

          {open && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-400">Controls</h4>
                  <button type="button" onClick={onOpenControls}
                          className="inline-flex items-center gap-1 text-[0.75rem] text-brand-700 hover:underline">
                    Control Library <ExternalLink size={12} />
                  </button>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {data.controls.map(c => (
                    <li key={c} className="text-[0.875rem] text-ink-800">{c}</li>
                  ))}
                  {data.controls.length === 0 && <li className="text-[0.875rem] text-ink-400">None.</li>}
                </ul>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-400">Workflows</h4>
                  <button type="button" onClick={onOpenWorkflows}
                          className="inline-flex items-center gap-1 text-[0.75rem] text-brand-700 hover:underline">
                    Workflow Library <ExternalLink size={12} />
                  </button>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {data.workflows.map(w => (
                    <li key={w} className="text-[0.875rem] text-ink-800">{w}</li>
                  ))}
                  {data.workflows.length === 0 && <li className="text-[0.875rem] text-ink-400">None.</li>}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </Block>
  );
}

/* ── PU-08 · Exceptions caught ───────────────────────────────────────────── */

export function ExceptionsCaught({
  data,
  periodLabel,
  onOpenException,
}: {
  data: ExceptionsResult;
  periodLabel: string;
  onOpenException: (id: string) => void;
}) {
  return (
    <Block
      title="Exceptions caught"
      hint="By severity, with the count still open."
      lede={
        data.total === 0 ? null : (
          <>
            The runs caught <Fig>{plural(data.total, 'exception', 'exceptions')}</Fig> {periodLabel.toLowerCase()}
            {data.open > 0
              ? <>, and <Fig>{fmtInt(data.open)}</Fig> {data.open === 1 ? 'is' : 'are'} still open.</>
              : <>, and every one of them has been closed.</>}
          </>
        )
      }
      chart={
        data.total === 0 ? (
          <Empty kind="quiet" title="Nothing was caught in this window." detail="The runs completed and found nothing to raise." />
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-x-10 gap-y-4 mb-4">
              <Stat size="md" value={fmtInt(data.total)} label={`raised ${periodLabel.toLowerCase()}`} />
              <Stat size="sm" value={fmtInt(data.open)} label="still open" />
            </div>
            <Bars
              rows={data.bySeverity.map(s => ({
                label: s.severity,
                value: s.total,
                note: s.open > 0 ? `${plural(s.open, 'still open', 'still open')}` : 'all resolved',
              }))}
              tone="risk"
            />
            <ul className="mt-4 divide-y divide-canvas-border border-t border-canvas-border">
              {data.rows.slice(0, 3).map(r => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onOpenException(r.id)}
                    className="w-full text-left py-2.5 group"
                  >
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-[0.875rem] text-ink-800 group-hover:text-brand-700 truncate">{r.title}</span>
                      <span className="text-[0.75rem] text-ink-400 shrink-0 tabular-nums">{formatWhen(r.openedAt)}</span>
                    </div>
                    <p className="text-[0.75rem] text-ink-500">
                      {r.ref} · {r.severity} · {r.status} · from {r.workflowName}
                      {r.runId && <> · run {r.runId}</>}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
            {data.rows.length > 3 && (
              <p className="mt-2 text-[0.75rem] text-ink-400 tabular-nums">
                3 newest of {fmtInt(data.rows.length)}. The table has all of them.
              </p>
            )}
          </>
        )
      }
      table={
        <DataTable
          head={['Reference', 'Severity', 'Status', 'Workflow', 'Raised']}
          numericFrom={5}
          rows={data.rows.map(r => [r.ref, r.severity, r.status, r.workflowName, formatWhen(r.openedAt)])}
        />
      }
    />
  );
}
