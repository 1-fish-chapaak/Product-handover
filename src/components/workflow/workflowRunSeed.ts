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
 * Build the assistant's opening recap of a completed run as markdown prose.
 *
 * The chat markdown pipeline (renderAssistantText) does NOT enable GFM, so
 * markdown tables won't render — we deliberately summarise as headings, a
 * KPI sentence, and a short highlight list instead of dumping a table the
 * user just saw on the previous screen.
 */
export function buildWorkflowRunRecap(seed: WorkflowRunSeed): string {
  const kpiSentence = seed.kpis
    .map((k) => `**${k.value}** ${k.label.toLowerCase()}`)
    .join(' · ');

  // Surface the first few result rows as a scannable bullet list. We assume
  // the first column is the primary identifier and the second is a label.
  const previewRows = seed.rows.slice(0, 4);
  const highlights = previewRows
    .map((row) => {
      const id = row[0] ?? '';
      const rest = row.slice(1).filter(Boolean).join(' · ');
      return `- \`${id}\`${rest ? ` — ${rest}` : ''}`;
    })
    .join('\n');

  const more =
    seed.rows.length > previewRows.length
      ? `\n\n…and ${seed.rows.length - previewRows.length} more in **${seed.resultTitle}**.`
      : '';

  return `## ${seed.workflowName} — run complete

${kpiSentence}.

Here are the top findings from **${seed.resultTitle}**:

${highlights}${more}

The full output, plan, and sources are on the previous screen. Ask me anything about these results and I'll dig in.`;
}
