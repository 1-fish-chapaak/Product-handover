import { CheckCircle2, CircleStop, RotateCcw } from 'lucide-react';
import RunStatusPill from './RunStatusPill';
import type { WorkflowBatch } from './useWorkflowBatch';

const CHIP = 'flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium cursor-pointer transition-colors';

/** Everything a batch shows below its button: a progress header + bar while
 *  runs are in flight, the per-workflow status rows (with Stop / Retry when
 *  `controls` is on — the live sync; bulk runs consume uploads that clear at
 *  start, so their rows are read-only), and the collapsed success line. */
export default function RunStatusPanel({ batch, controls = false }: { batch: WorkflowBatch; controls?: boolean }) {
  const { rows, pendingCount, successText } = batch;
  const finished = rows.filter(r => r.tone === 'done' || r.tone === 'failed').length;
  const total = finished + pendingCount;
  const pct = total > 0 ? Math.round((finished / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-3" data-testid="run-status-panel">
      {pendingCount > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5">
          <p className="text-xs text-brand-800">{finished} of {total} runs finished. The dashboard updates itself as each one completes.</p>
          <div className="h-1.5 rounded-full bg-brand-100 overflow-hidden">
            <div className="h-full rounded-full bg-brand-600 transition-all duration-500" style={{ width: `${Math.max(pct, 4)}%` }} />
          </div>
        </div>
      )}
      {rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map(row => (
            <li key={row.workflowId} className="flex flex-col gap-0.5" data-testid="batch-row">
              <span className="flex items-center justify-between gap-2 min-w-0">
                <span className="text-xs text-ink-700 truncate" title={row.name}>{row.name}</span>
                <span className="flex items-center gap-1.5 shrink-0">
                  {controls && row.tone === 'started' && (
                    <button type="button" onClick={() => batch.stopRun(row.workflowId)} title="Stop this run — the dashboard keeps its previous data"
                      className={`${CHIP} border-canvas-border text-ink-600 hover:text-risk-700 hover:border-risk-200 hover:bg-risk-50`} data-testid="batch-stop">
                      <CircleStop size={11} /> Stop
                    </button>
                  )}
                  {controls && row.tone === 'failed' && (
                    <button type="button" onClick={() => batch.retryRun(row.workflowId)} title="Run this workflow again"
                      className={`${CHIP} border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100`} data-testid="batch-retry">
                      <RotateCcw size={11} /> Retry
                    </button>
                  )}
                  <RunStatusPill tone={row.tone} />
                </span>
              </span>
              {row.detail !== null && (
                <p className={`text-xs wrap-break-word ${row.tone === 'failed' ? 'text-risk-700' : 'text-ink-500'}`}>{row.detail}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      {successText !== null && (
        <p className="flex items-center gap-2 text-xs text-compliant-700" data-testid="batch-success">
          <CheckCircle2 size={14} className="shrink-0" />
          {successText}
        </p>
      )}
    </div>
  );
}
