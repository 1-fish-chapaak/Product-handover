// ─── Automation Project — Output Review Tab ──────────────────────────────
// Placeholder: bulk execution output work in progress.

import { Loader2, Workflow, CheckCircle2, Clock } from 'lucide-react';
import type { ConfigurableEngagement, AutomationProjectConfig } from '../../configurableEngagementTypes';
import type { AutomationRunsState } from './automationRunsData';
import type { AutomationOutputReviewState } from './automationOutputReviewData';

interface Props {
  engagement: ConfigurableEngagement;
  runsState: AutomationRunsState;
  outputReview: AutomationOutputReviewState;
  onUpdateOutputReview: (state: AutomationOutputReviewState) => void;
  onNavigateTab?: (tabId: string) => void;
}

export default function AutomationOutputReviewTab({ engagement, runsState, onNavigateTab }: Props) {
  const completedRuns = runsState.runs.filter(r => r.status === 'COMPLETED');
  const runningRuns = runsState.runs.filter(r => r.status === 'RUNNING');
  const totalOutputs = completedRuns.flatMap(r => r.outputs).length;
  const totalExceptions = completedRuns.flatMap(r => r.exceptions).length;

  // Derive workflow names from completed runs
  const workflowNames = new Set<string>();
  for (const run of completedRuns) {
    for (const out of run.outputs) {
      if (out.sourceWorkflowName) workflowNames.add(out.sourceWorkflowName);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h3 className="text-[0.9375rem] font-bold text-text mb-0.5">Bulk Execution Output</h3>
        <p className="text-[0.75rem] text-text-muted">Workflow execution status and output summary.</p>
      </div>

      {/* Status card */}
      <div className="rounded-2xl border-2 border-dashed border-primary/20 bg-gradient-to-br from-primary/5 to-purple-50/30 p-8 text-center space-y-4">
        {runningRuns.length > 0 ? (
          <>
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mx-auto">
              <Loader2 size={28} className="text-primary animate-spin" />
            </div>
            <h4 className="text-[1rem] font-bold text-text">Execution in Progress</h4>
            <p className="text-[0.75rem] text-text-muted max-w-md mx-auto">
              {runningRuns.length} workflow run{runningRuns.length !== 1 ? 's' : ''} currently executing.
              Outputs and exceptions will appear here once complete.
            </p>
          </>
        ) : completedRuns.length > 0 ? (
          <>
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 mx-auto">
              <CheckCircle2 size={28} className="text-emerald-500" />
            </div>
            <h4 className="text-[1rem] font-bold text-text">Bulk Execution Complete</h4>
            <p className="text-[0.75rem] text-text-muted max-w-md mx-auto">
              {completedRuns.length} run{completedRuns.length !== 1 ? 's' : ''} completed across {workflowNames.size} workflow{workflowNames.size !== 1 ? 's' : ''}. Review exceptions and assign cases in the Cases tab.
            </p>
          </>
        ) : (
          <>
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-100 mx-auto">
              <Clock size={28} className="text-gray-400" />
            </div>
            <h4 className="text-[1rem] font-bold text-text">Waiting for Execution</h4>
            <p className="text-[0.75rem] text-text-muted max-w-md mx-auto">
              No workflows have been executed yet. Go to the Workflows tab to start a bulk run.
            </p>
            <button onClick={() => onNavigateTab?.('workflows')} className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors">
              Go to Workflows
            </button>
          </>
        )}
      </div>

      {/* Workflow output summary cards */}
      {completedRuns.length > 0 && (
        <>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Runs Completed', value: completedRuns.length, cls: 'text-emerald-600' },
              { label: 'Workflows', value: workflowNames.size },
              { label: 'Outputs Generated', value: totalOutputs },
              { label: 'Exceptions Found', value: totalExceptions, cls: totalExceptions > 0 ? 'text-amber-600' : 'text-emerald-600' },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-border-light bg-white p-4 text-center">
                <div className={`text-[1.25rem] font-bold tabular-nums ${s.cls || 'text-text'}`}>{s.value}</div>
                <div className="text-[0.625rem] text-gray-400 font-medium mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Per-workflow status rows */}
          <div className="space-y-2">
            <h4 className="text-[0.75rem] font-bold text-text">Workflow Outputs</h4>
            {Array.from(workflowNames).map(wfName => {
              const wfOutputs = completedRuns.flatMap(r => r.outputs).filter(o => o.sourceWorkflowName === wfName);
              const wfExceptions = completedRuns.flatMap(r => r.exceptions).filter(e => e.sourceWorkflowName === wfName);
              const records = wfOutputs.reduce((s, o) => s + (o.recordCount || 0), 0);
              return (
                <div key={wfName} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border-light bg-white">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0"><Workflow size={14} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[0.8125rem] font-semibold text-text truncate">{wfName}</div>
                    <div className="text-[0.625rem] text-text-muted mt-0.5">
                      {records.toLocaleString()} records processed
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[0.625rem] shrink-0">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">{wfOutputs.length} output{wfOutputs.length !== 1 ? 's' : ''}</span>
                    <span className={`px-2 py-0.5 rounded-full font-bold ${wfExceptions.length > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {wfExceptions.length} exception{wfExceptions.length !== 1 ? 's' : ''}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">
                      <CheckCircle2 size={10} className="inline mr-0.5" />Complete
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
