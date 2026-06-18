// Shared contract for handing a completed workflow run into the chat as
// pre-existing conversation history. The Workflow Executor produces a
// WorkflowRunSeed when the user clicks a follow-up query; App.tsx carries it
// through state; ChatView consumes it on mount and replays it as a user turn
// ("I ran X") + an assistant turn (the run recap) so the follow-up question
// lands inside a thread that already has context — not a cold start.
//
// Kept in its own tiny module (rather than exported from the large ChatView
// file) so the hook layer can `import type` it without depending on the
// component graph.

export interface WorkflowRunKpi {
  label: string;
  value: string;
  note?: string;
}

export interface WorkflowRunSeed {
  workflowId: string;
  workflowName: string;
  category?: string;
  /** Headline metrics, already formatted for display (e.g. "4,521", "3.0s"). */
  kpis: WorkflowRunKpi[];
  /** Title of the results table shown on the executor output screen. */
  resultTitle: string;
  /** Column headers for the result rows. */
  columns: string[];
  /** Result rows as pre-stringified cells, parallel to `columns`. */
  rows: string[][];
}

/**
 * Short prose intro for the rich workflow-run recap. This does NOT flatten the
 * metrics/rows into text — the chat renders the run's actual KPI cards and
 * results table beneath this line (richType 'workflow-run-recap'), so the thread
 * mirrors the executor output instead of a stripped-down summary.
 */
export function buildWorkflowRunRecapIntro(seed: WorkflowRunSeed): string {
  return `## ${seed.workflowName} — run complete

Here's the full output from this run. Ask me anything about these results and I'll dig in.`;
}
