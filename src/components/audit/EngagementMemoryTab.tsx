// ─── Engagement Memory tab — the engagement's shared brain (decision D3) ────
//
// "Memory across platform" PRD: shared memory lives in My Queue and the
// Engagement Memory tab. This is the scoped WORKING view — the ground rules a
// new joiner reads in five minutes: how controls are tested, which files are
// approved, what's carved out, what the client's words mean, which exceptions
// are known false positives. The same rows list in Smart Learn (D2: one
// registry); here they're grouped by what they govern and worked in place.
//
// Rendered inside the engagement workspace, so it uses that surface's palette
// (text / primary / surface-2 / border-light), not the Editorial canvas tokens.

import { useMemo, useState } from 'react';
import {
  Brain, BookOpen, CalendarClock, Check, ChevronRight, CircleSlash,
  FileSearch, FlaskConical, Landmark, ShieldAlert, Undo2, X,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import {
  KIND_META, RENEWAL_TARGET,
  type PlatformMemory,
} from '../../data/memoryStore';
import {
  useMemorySessionVersion, allMemories, decisionFor,
  forgetMemory, undoForget, renewMemory, captureMemory,
} from '../../data/memorySession';
import { navigateToMemory } from '../shared/memory/MemoryKit';
import type { Engagement } from '../../data/engagements';

// Groups are "what the rule governs", not memory kinds — a joiner scans for
// the job they're about to do, not for taxonomy.
type GroupId = 'testing' | 'files' | 'scope' | 'vocabulary' | 'known-issues';

const GROUP_META: { id: GroupId; label: string; icon: React.ElementType; note: string }[] = [
  { id: 'testing', label: 'Testing & sampling', icon: FlaskConical, note: 'How controls are tested here — fires when anyone draws a sample' },
  { id: 'files', label: 'Files & columns', icon: FileSearch, note: 'The approved sources and what their columns mean' },
  { id: 'scope', label: 'Scope & calendar', icon: Landmark, note: 'Materiality, carve-outs and period rules' },
  { id: 'vocabulary', label: 'Client vocabulary', icon: BookOpen, note: 'The client’s words, translated silently' },
  { id: 'known-issues', label: 'Known issues', icon: ShieldAlert, note: 'Patterns that look like exceptions but aren’t — folded out of findings' },
];

function groupOf(m: PlatformMemory): GroupId {
  if (m.kind === 'vocabulary') return 'vocabulary';
  if (m.kind === 'correction') return 'known-issues';
  if (/sampl|test|evidence/i.test(m.statement)) return 'testing';
  if (/file|master|column|copy|source/i.test(m.statement)) return 'files';
  return 'scope';
}

let captureSeq = 0;

export default function EngagementMemoryTab({ eng }: { eng: Engagement }) {
  const sessionVersion = useMemorySessionVersion();
  const { addToast } = useToast();
  const [teachOpen, setTeachOpen] = useState(false);
  const [teachText, setTeachText] = useState('');

  // The flagship engagement world (Pharma Chargeback / MCKESSON) carries the
  // seeded ground rules; other engagements start empty and fill via capture.
  const isPricing = /p2p|procure|vendor|invoice|pricing|chargeback/i.test(`${eng.name} ${eng.process ?? ''} ${eng.subtype ?? ''}`);
  const rows = useMemo(
    () => allMemories().filter(m =>
      m.scope === 'engagement' &&
      (m.entity?.id === eng.id || (isPricing && m.entity?.id === 'eng-pharma-fy26'))),
    [eng.id, isPricing, sessionVersion],
  );

  const live = rows.filter(m => !decisionFor(m.id)?.forgotten && m.status !== 'retired');
  const proposed = live.filter(m => m.status === 'proposed');
  const reviewDue = live.filter(m => m.renewDue);

  const teach = () => {
    const statement = teachText.trim();
    if (!statement) return;
    captureSeq += 1;
    captureMemory({
      id: `mem-cap-eng-${captureSeq}`,
      scope: 'engagement', kind: 'fact', status: 'proposed',
      statement,
      source: 'Taught on the engagement Memory tab',
      pendingNote: 'Proposed by you just now — waiting on lead approval in My Queue.',
      evidence: [{ label: 'Engagement · taught directly on the Memory tab', date: 'today' }],
      learnedOn: 'today', recallCount: 0, lastRecalled: '—',
      firesIn: ['engagements', 'runs'],
      entity: { id: eng.id, label: eng.name },
    });
    setTeachText('');
    setTeachOpen(false);
    addToast({ type: 'success', message: 'Proposed to engagement memory — review lands in My Queue.' });
  };

  return (
    <div className="pb-8">
      {/* Header row — what this tab is + the capture CTA */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[1.0625rem] font-bold text-text">Engagement memory</h2>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.6875rem] font-bold tabular-nums text-primary">{live.length} active</span>
            {proposed.length > 0 && (
              <span className="rounded-full bg-mitigated-50 px-2 py-0.5 text-[0.6875rem] font-bold tabular-nums text-mitigated-700">{proposed.length} awaiting approval</span>
            )}
            {reviewDue.length > 0 && (
              <span className="rounded-full bg-mitigated-50 px-2 py-0.5 text-[0.6875rem] font-bold tabular-nums text-mitigated-700">{reviewDue.length} review due</span>
            )}
          </div>
          <p className="mt-1 text-[0.8125rem] text-text-secondary max-w-2xl">
            The ground rules everyone on <span className="font-semibold text-text">{eng.name}</span> works by — applied automatically wherever they fire, listed in Smart Learn, approved in My Queue.
          </p>
        </div>
        <button
          onClick={() => setTeachOpen(o => !o)}
          className="shrink-0 inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[0.8125rem] font-semibold text-white hover:opacity-90 transition-opacity cursor-pointer"
        >
          <Brain size={14} /> Teach this engagement
        </button>
      </div>

      {/* Inline capture — one sentence, proposed into the shared store */}
      {teachOpen && (
        <div className="mb-4 rounded-xl border border-dashed border-primary/40 bg-primary/[0.04] px-4 py-3">
          <div className="text-[0.6875rem] font-bold uppercase tracking-wider text-primary mb-1.5">New ground rule — one governed sentence</div>
          <div className="flex items-center gap-2">
            <input
              autoFocus
              type="text"
              value={teachText}
              onChange={e => setTeachText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') teach(); if (e.key === 'Escape') setTeachOpen(false); }}
              placeholder='e.g. "Testing uses the March extract until the client re-cuts the ledger."'
              className="h-9 flex-1 rounded-md border border-border-light bg-white px-3 text-[0.8125rem] text-text placeholder:text-text-muted outline-none focus:border-primary/40"
            />
            <button onClick={teach} className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-[0.8125rem] font-semibold text-white hover:opacity-90 transition-opacity cursor-pointer">
              Propose
            </button>
            <button onClick={() => setTeachOpen(false)} className="inline-flex h-9 items-center rounded-md px-2 text-[0.8125rem] font-medium text-text-muted hover:text-text transition-colors cursor-pointer">
              Cancel
            </button>
          </div>
          <p className="mt-1.5 text-[0.6875rem] text-text-muted">Shared memory needs a human yes — your proposal goes to My Queue, then applies for everyone.</p>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-light bg-white px-6 py-10 text-center">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg bg-surface-2">
            <Brain size={18} className="text-text-muted" />
          </div>
          <p className="text-[0.8125rem] font-semibold text-text">No ground rules yet.</p>
          <p className="mx-auto mt-1 max-w-md text-[0.75rem] leading-relaxed text-text-muted">
            IRA will propose memories as this engagement runs — sampling standards, approved files, carve-outs, client vocabulary. Or teach one directly.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {GROUP_META.map(g => {
            const groupRows = rows.filter(m => groupOf(m) === g.id);
            if (groupRows.length === 0) return null;
            const GIcon = g.icon;
            return (
              <section key={g.id} aria-label={g.label}>
                <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
                  <span className="flex items-center gap-1.5">
                    <GIcon size={13} className="translate-y-px text-text-muted" />
                    <h3 className="text-[0.75rem] font-bold uppercase tracking-wider text-text">{g.label}</h3>
                    <span className="rounded-full bg-surface-2 px-1.5 py-px text-[0.625rem] font-bold tabular-nums text-text-muted">{groupRows.length}</span>
                  </span>
                  <span className="text-[0.6875rem] text-text-muted">{g.note}</span>
                </div>
                <div className="space-y-2">
                  {groupRows.map(m => {
                    const d = decisionFor(m.id);
                    if (d?.forgotten) {
                      return (
                        <div key={m.id} className="flex items-center gap-2 rounded-xl border border-border-light bg-surface-2 px-4 py-2.5">
                          <CircleSlash size={13} className="shrink-0 text-text-muted" />
                          <span className="min-w-0 flex-1 truncate text-[0.75rem] text-text-secondary">Retired for everyone — logged to the audit trail.</span>
                          <button onClick={() => undoForget(m)} className="inline-flex shrink-0 items-center gap-1 text-[0.6875rem] font-semibold text-primary hover:underline cursor-pointer">
                            <Undo2 size={11} /> Undo
                          </button>
                        </div>
                      );
                    }
                    const isProposed = m.status === 'proposed';
                    return (
                      <div key={m.id} className="rounded-xl border border-border-light bg-white px-4 py-3">
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[0.8125rem] font-medium leading-snug text-text">{m.statement}</p>
                            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[0.6875rem] text-text-muted">
                              <span className="font-mono font-semibold text-primary">{KIND_META[m.kind].label}</span>
                              <span>·</span>
                              <span>{m.source}</span>
                              {m.approvedBy && <><span>·</span><span>approved by {m.approvedBy}</span></>}
                              <span>·</span>
                              <span className="tabular-nums">fired {m.recallCount}×</span>
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 pt-0.5">
                            {isProposed && (
                              <span className="inline-flex items-center rounded-full bg-mitigated-50 px-2 py-0.5 text-[0.625rem] font-bold text-mitigated-700">Awaiting approval</span>
                            )}
                            {m.renewDue && m.reviewBy && (
                              <button
                                onClick={() => { renewMemory(m); addToast({ type: 'success', message: `Renewed until ${RENEWAL_TARGET}.` }); }}
                                className="inline-flex items-center gap-1 rounded-full border border-mitigated-50 bg-mitigated-50 px-2 py-0.5 text-[0.625rem] font-bold text-mitigated-700 hover:opacity-80 transition-opacity cursor-pointer"
                                title={`Review due ${m.reviewBy} — renew until ${RENEWAL_TARGET}`}
                              >
                                <CalendarClock size={10} /> Renew
                              </button>
                            )}
                            {decisionFor(m.id)?.renewedTo && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-compliant-50 px-2 py-0.5 text-[0.625rem] font-bold text-compliant-700">
                                <Check size={9} strokeWidth={3} /> Renewed
                              </span>
                            )}
                            {!isProposed && (
                              <button
                                onClick={() => { forgetMemory(m); addToast({ type: 'info', message: 'Retired for everyone — logged.' }); }}
                                title="Retire for everyone"
                                className="text-text-muted hover:text-risk-700 transition-colors cursor-pointer"
                              >
                                <X size={13} />
                              </button>
                            )}
                            <button
                              onClick={() => navigateToMemory(m.id)}
                              title="View in Smart Learn"
                              className="inline-flex items-center gap-0.5 text-[0.6875rem] font-semibold text-text-muted hover:text-primary transition-colors cursor-pointer"
                            >
                              Registry <ChevronRight size={11} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
