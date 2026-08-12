// ─── Universal insight actions — the three always-on platform verbs ─────────
//
// Every insight card carries the same three actions, whatever the finding:
//
//   1. Drill down in chat   — interrogate the insight in Ask IRA (new tab; the
//                             whole card travels and sends on arrival).
//   2. Run frequency        — open the source workflow's details page on its
//                             Configuration tab (new tab): cadence is set where
//                             it lives, not in a drawer dropdown (review call
//                             Aug 11 — the in-place panel is retired).
//   3. Edit workflow        — open the workflow edit-in-chat journey in a new
//                             tab with this insight's context carried along.
//
// They render INSIDE the Recommended-actions grid as tiles with the same
// anatomy as the AI recommendations (imperative title + target chip) — one
// action surface, one grammar. What still distinguishes them is their copy:
// each names the workflow and the mechanic, so they read as capabilities,
// not judgments.

import { useMemo } from 'react';
import { MessageSquareText, CalendarClock, PenLine } from 'lucide-react';
import type { LayeredInsight } from '../../data/layeredInsights';
import {
  resolveWorkflowForInsight, useWorkflowFrequency, suggestFrequency,
  drillDownInChat, openWorkflowEditor, suggestedWorkflowChange,
  FREQUENCY_META,
} from '../../data/workflowActions';

// One platform-verb tile — same anatomy as InsightActions' RecTile (imperative
// title, optional chip, quiet right icon) so the grid reads as one surface.
// The icon names the mechanic (chat / cadence / editor) where RecTile's
// MessageSquare says "runs in Ask IRA".
function PlatformTile({ icon, title, chip, onClick, tooltip }: {
  icon: React.ReactNode;
  title: string;
  /** Small marker under the title — the workflow it lands on / current state. */
  chip?: string;
  onClick: () => void;
  tooltip: string;
}) {
  return (
    <button
      type="button" onClick={onClick} title={tooltip}
      className="group flex w-full items-start gap-2 text-left rounded-lg border border-canvas-border bg-canvas-elevated py-2.5 pl-3 pr-2.5 hover:border-brand-300 hover:bg-brand-50/40 transition-colors cursor-pointer"
    >
      <span className="min-w-0 flex-1 text-[12.5px] font-semibold text-ink-900 leading-snug group-hover:text-brand-700 transition-colors">
        <span className="line-clamp-2">{title}</span>
        {chip && (
          <span className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold bg-evidence-50 text-evidence-700">
            <span className="truncate">{chip}</span>
          </span>
        )}
      </span>
      <span className="mt-0.5 shrink-0 text-ink-300 group-hover:text-brand-600 transition-colors" aria-hidden="true">
        {icon}
      </span>
    </button>
  );
}

const openTab = (query: string) => {
  try {
    window.open(query, '_blank', 'noopener,noreferrer');
  } catch {
    /* popup blocked */
  }
};

// ─── The grid ───────────────────────────────────────────────────────────────

export default function UniversalInsightActions({ insight, className = '', gridChildren }: {
  insight: LayeredInsight;
  className?: string;
  /** The caller's recommendation tiles (as <li> nodes) — rendered in the SAME
   *  grid ahead of the three platform tiles, so the block reads as one
   *  action surface with one anatomy. */
  gridChildren?: React.ReactNode;
}) {
  const wf = useMemo(() => resolveWorkflowForInsight(insight), [insight]);
  const frequency = useWorkflowFrequency(wf?.id ?? '');
  const suggestion = useMemo(() => (wf ? suggestFrequency(insight, frequency) : null), [wf, insight, frequency]);

  const noWorkflowNote = 'This insight does not trace to a runnable workflow yet — link one from the Workflows tab to act on cadence or logic.';

  return (
    <div className={className}>
      <ul className="grid sm:grid-cols-2 gap-1.5 items-start">
        {gridChildren}
        <li className="min-w-0">
          <PlatformTile
            icon={<MessageSquareText size={12} />}
            title="Drill down on this insight in chat — its evidence travels with the question."
            tooltip="Interrogate this insight in Ask IRA (new tab) — the whole card sends on arrival"
            onClick={() => drillDownInChat(insight)}
          />
        </li>
        <li className="min-w-0">
          <PlatformTile
            icon={<CalendarClock size={12} />}
            title={wf
              ? suggestion
                ? `Retune how often ${wf.name} runs — IRA suggests ${FREQUENCY_META[suggestion.freq].label.toLowerCase()}.`
                : `Review how often ${wf.name} runs against this finding.`
              : 'Link a runnable workflow to act on run cadence from this card.'}
            chip={wf ? `${FREQUENCY_META[frequency].label} · current` : undefined}
            tooltip={wf
              ? `Open ${wf.name}'s Configuration page to set the cadence (new tab)`
              : noWorkflowNote}
            onClick={() => {
              if (wf) openTab(`?view=workflow-detail&workflowId=${encodeURIComponent(wf.id)}&tab=config`);
              else openTab('?section=workflows');
            }}
          />
        </li>
        <li className="min-w-0">
          <PlatformTile
            icon={<PenLine size={12} />}
            title={wf
              ? 'Edit the workflow logic — this insight rides along as context.'
              : 'Link a runnable workflow to edit its logic from this card.'}
            chip={wf ? `→ ${wf.name}` : undefined}
            tooltip={wf
              ? `Open ${wf.name} in the editor with this insight's context (new tab) — suggested change: ${suggestedWorkflowChange(insight)}`
              : noWorkflowNote}
            onClick={() => {
              if (wf) openWorkflowEditor(insight, wf);
              else openTab('?section=workflows');
            }}
          />
        </li>
      </ul>
    </div>
  );
}
