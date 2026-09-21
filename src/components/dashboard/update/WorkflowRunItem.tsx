import { Check, ExternalLink, History, Loader2 } from 'lucide-react';
import { formatRunDuration, formatRunTimestamp, type WorkflowRun } from '../../../data/dashboardUpdate';

/** One previous run: timestamp, duration, files used, Current badge, and an
 *  inline confirm strip once picked. */
export default function WorkflowRunItem({ run, isCurrent, isPending, isApplying, disabled, onPick, onConfirm, onCancel, onOpen }: {
  run: WorkflowRun;
  isCurrent: boolean;
  isPending: boolean;
  isApplying: boolean;
  disabled: boolean;
  onPick: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onOpen: () => void;
}) {
  const files = run.files.join(', ');
  const clickable = !isCurrent && !disabled && !isApplying;
  return (
    <div className="rounded-lg border border-canvas-border bg-canvas-elevated" data-testid="workflow-run-item">
      {/* The open-run control is a SIBLING of the pick button — nested buttons
          are invalid, and a click on it must never reach the pick handler. */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={onPick}
          disabled={!clickable}
          className="min-w-0 flex-1 flex items-center gap-3 p-3 text-left cursor-pointer disabled:cursor-default hover:bg-canvas disabled:hover:bg-transparent rounded-l-lg"
          data-testid="workflow-run-pick"
        >
          <History size={16} className="text-brand-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink-900">
              {formatRunTimestamp(run.completedAt)}
              <span className="font-normal text-ink-500"> · {formatRunDuration(run.durationSecs)}</span>
            </p>
            {files !== '' && <p className="text-xs text-ink-400 truncate" title={files}>Files: {files}</p>}
          </div>
          {isCurrent && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold shrink-0" data-testid="workflow-run-current">
              <Check size={11} /> Current
            </span>
          )}
          {isApplying && (
            <span className="flex items-center gap-1.5 text-xs text-ink-500 shrink-0">
              <Loader2 size={13} className="animate-spin" /> Updating dashboard…
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="mr-2 ml-1 p-1.5 rounded-md text-ink-400 hover:text-brand-700 hover:bg-brand-50 cursor-pointer transition-colors shrink-0"
          title="Open this run in the workflow executor"
          aria-label="Open this run in the workflow executor"
        >
          <ExternalLink size={14} />
        </button>
      </div>
      {isPending && !isApplying && (
        <div className="border-t border-canvas-border p-3 flex items-center justify-between gap-3">
          <p className="text-xs text-ink-500">Dashboard will switch to this run’s outputs. The next workflow run brings back the latest data.</p>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={onCancel} className="px-3 h-8 text-xs text-ink-500 hover:text-ink-700 cursor-pointer">Cancel</button>
            <button type="button" onClick={onConfirm} className="px-3 h-8 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-semibold cursor-pointer" data-testid="workflow-run-apply">Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}
