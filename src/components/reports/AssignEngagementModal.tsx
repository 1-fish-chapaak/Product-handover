// Shown once, right after a new template is created: an optional way to say
// which engagement it was built for. Purely informational — it labels the
// template in the Templates list, it does not restrict who can use it. One
// click on a row assigns and closes; nothing here is a required step.

import { useMemo, useState } from 'react';
import Modal from '../shared/Modal';
import { ENGAGEMENTS, PROCESS_COLORS, type Engagement } from '../../data/engagements';

export default function AssignEngagementModal({
  templateName,
  onAssign,
  onSkip,
}: {
  templateName: string;
  onAssign: (engagementId: string) => void;
  onSkip: () => void;
}) {
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ENGAGEMENTS;
    return ENGAGEMENTS.filter((e: Engagement) =>
      e.name.toLowerCase().includes(q) || e.code.toLowerCase().includes(q));
  }, [query]);

  return (
    <Modal
      title="Tag this template to an engagement?"
      subtitle={`Optional. It shows "${templateName}" was built for a specific engagement, and you can change it later from Edit template.`}
      onClose={onSkip}
      ariaLabel="Tag this template to an engagement"
      footer={
        <button
          type="button"
          onClick={onSkip}
          className="inline-flex h-9 items-center rounded-md border border-canvas-border bg-white px-4 text-[0.875rem] font-semibold text-ink-700 transition-colors hover:bg-paper-50 cursor-pointer"
        >
          Skip for now
        </button>
      }
    >
      <input
        autoFocus
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search engagements…"
        className="w-full h-10 px-3 rounded-lg border border-canvas-border text-[0.8125rem] transition-colors hover:border-ink-300 focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10"
      />
      <div className="mt-3 max-h-[320px] overflow-y-auto rounded-lg border border-canvas-border">
        {matches.length === 0 ? (
          <p className="px-3 py-6 text-center text-[0.8125rem] text-ink-400">No engagements match "{query}".</p>
        ) : (
          matches.map(e => (
            <button
              key={e.id}
              type="button"
              onClick={() => onAssign(e.id)}
              className="flex w-full items-center gap-2.5 border-b border-canvas-border px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-brand-50/50 cursor-pointer"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: PROCESS_COLORS[e.process] }} />
              <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-ink-900">{e.name}</span>
              <span className="shrink-0 font-mono text-[0.6875rem] text-ink-400">{e.code}</span>
            </button>
          ))
        )}
      </div>
    </Modal>
  );
}
