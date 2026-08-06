// Where a custom format is allowed to be used. It opens on save, for a new
// template and for an edit, and it is the ONLY place this is set: the builder
// is about what the document looks like, not about who gets to use it.
//
// Two choices, and they are exclusive because they answer one question:
//   • All internal audit reports — this format is the one they start in, and
//     one format holds that at a time, so choosing it replaces the last.
//   • One engagement — only that engagement's reports start in it.
// Neither locks anything: the report's own Apply Template picker still switches
// a single report to any format on the list, and both descriptions say so,
// because "starts in" reads like "stuck with" otherwise.
//
// Only internal audit engagements are listed. These formats are written for
// internal audit work, so a compliance or SOX engagement in the list would be a
// choice nobody can act on.

import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import Modal from '../shared/Modal';
import { ENGAGEMENTS, PROCESS_COLORS, findEngagement, type Engagement } from '../../data/engagements';
import { templateScope, type TemplateScope } from './templateScope';

export default function TemplateScopeModal({
  templateName,
  currentEngagementId,
  currentDefaultName,
  onApply,
  onSkip,
}: {
  templateName: string;
  currentEngagementId?: string;
  /** The format internal audit reports start in today, when that is not this
   *  one. Named in the option, because taking the slot quietly would be a lie. */
  currentDefaultName?: string;
  onApply: (next: { engagementId?: string; isDefault?: boolean }) => void;
  onSkip: () => void;
}) {
  const saved = templateScope({ engagementId: currentEngagementId });
  const [scope, setScope] = useState<TemplateScope>(saved);
  const [engagementId, setEngagementId] = useState(currentEngagementId ?? '');
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const iaOnly = ENGAGEMENTS.filter((e: Engagement) => e.type === 'Internal Audit');
    if (!q) return iaOnly;
    return iaOnly.filter((e: Engagement) =>
      e.name.toLowerCase().includes(q) || e.code.toLowerCase().includes(q));
  }, [query]);

  const picked = engagementId ? findEngagement(engagementId) : undefined;
  // The only thing that can hold the button back is an engagement choice with
  // no engagement picked yet. Re-confirming the answer it already has is a
  // fine thing to do, so an unchanged pick still saves.
  const ready = scope !== 'engagement' || !!engagementId;

  const commit = () => {
    if (!ready) return;
    onApply(scope === 'engagement'
      ? { engagementId, isDefault: undefined }
      : { engagementId: undefined, isDefault: true });
  };

  const OPTIONS: { key: TemplateScope; title: string; desc: string }[] = [
    {
      key: 'internal-audit',
      title: 'All internal audit reports',
      desc: 'New internal audit reports come out in this format. You can still put any one report in a different format, from the report itself.',
    },
    {
      key: 'engagement',
      title: 'One engagement',
      desc: 'Only reports for the engagement you pick. Every other internal audit keeps the format it has now.',
    },
  ];

  return (
    <Modal
      title="Which reports use this format?"
      subtitle={`"${templateName}" is saved. Now pick the reports it applies to. You can change this later by saving the format again.`}
      width="max-w-[600px]"
      onClose={onSkip}
      ariaLabel="Which reports use this format"
      footer={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex h-9 items-center rounded-md border border-canvas-border bg-white px-4 text-[0.875rem] font-semibold text-ink-700 transition-colors hover:bg-paper-50 cursor-pointer"
          >
            Leave it as it is
          </button>
          <button
            type="button"
            onClick={commit}
            disabled={!ready}
            className="inline-flex h-9 items-center rounded-md bg-brand-600 px-4 text-[0.875rem] font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-ink-200 disabled:text-ink-400 cursor-pointer"
          >
            Save
          </button>
        </div>
      }
    >
      <div className="space-y-2.5">
        {OPTIONS.map(opt => {
          const on = scope === opt.key;
          return (
            <div key={opt.key}>
              <button
                type="button"
                onClick={() => setScope(opt.key)}
                aria-pressed={on}
                className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3.5 text-left transition-colors cursor-pointer ${
                  on ? 'border-brand-400 bg-brand-50/50' : 'border-canvas-border bg-white hover:border-ink-300'
                }`}
              >
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  on ? 'border-brand-600 bg-brand-600' : 'border-ink-300 bg-white'
                }`}>
                  {on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.875rem] font-semibold text-ink-900">{opt.title}</span>
                  <span className="mt-1 block text-[0.75rem] leading-relaxed text-ink-500">{opt.desc}</span>
                  {/* One format at a time is the one reports start in, so say
                      whose place this takes rather than swapping it quietly. */}
                  {opt.key === 'internal-audit' && on && currentDefaultName && (
                    <span className="mt-2 block text-[0.75rem] font-medium text-mitigated-700">
                      This replaces {currentDefaultName}. That one stays on the list, so anyone can still pick it.
                    </span>
                  )}
                </span>
              </button>

              {/* The picker belongs to its own choice, so it opens under it
                  rather than sitting above all three doing nothing. */}
              {opt.key === 'engagement' && on && (
                <div className="mt-2.5 rounded-lg border border-canvas-border bg-canvas/60 p-3">
                  <input
                    autoFocus
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search internal audit engagements"
                    className="h-9 w-full rounded-lg border border-canvas-border bg-white px-3 text-[0.8125rem] transition-colors hover:border-ink-300 focus:border-brand-600/40 focus:outline-none focus:ring-2 focus:ring-brand-600/10"
                  />
                  <div className="mt-2 max-h-[188px] overflow-y-auto rounded-lg border border-canvas-border bg-white">
                    {matches.length === 0 ? (
                      <p className="px-3 py-6 text-center text-[0.8125rem] text-ink-400">No engagements match "{query}".</p>
                    ) : (
                      matches.map(e => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => setEngagementId(e.id)}
                          className={`flex w-full items-center gap-2.5 border-b border-canvas-border px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-brand-50/50 cursor-pointer ${
                            e.id === engagementId ? 'bg-brand-50/60' : ''
                          }`}
                        >
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: PROCESS_COLORS[e.process] }} />
                          <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-ink-900">{e.name}</span>
                          {e.id === engagementId && <Check size={14} className="shrink-0 text-brand-600" />}
                          <span className="shrink-0 font-mono text-[0.6875rem] text-ink-400">{e.code}</span>
                        </button>
                      ))
                    )}
                  </div>
                  <p className="mt-2 text-[0.6875rem] text-ink-400">
                    {picked ? `Reports for ${picked.name} come out in this format.` : 'Pick the engagement you built this format for.'}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
