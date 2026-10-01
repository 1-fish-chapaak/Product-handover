/**
 * Ask IRA — complex-prompt split.
 *
 * When a workflow prompt asks for several distinct tests, the GRC agent
 * doesn't cram them into one workflow: it proposes one check per control,
 * grouped under a recommended engagement (SplitPlanCard). Accepting commits
 * the plan and Ira builds each new check in turn, tracked by BuildQueueBar.
 * The General agent only nudges (AgentNudgeCard) — the agent is fixed for a
 * chat, so switching starts a fresh GRC chat with the same prompt.
 */
import { useState } from 'react';
import { ArrowRight, Check, ExternalLink, Layers, ShieldCheck, SkipForward, Square, Workflow as WorkflowIcon, CircleDashed, Link2, FileSearch } from 'lucide-react';
import { Button } from '../shared/Button';
import { Pill } from '../shared/StatusBadge';
import type { BuildQueue, NudgeData, SplitPlanData, SplitSummaryData } from './splitPlan';
import { coverageFor, withPhases, type AuditPlan, type PlanControl, type PlanEngagement } from '../../data/auditPlan';
import { CheckTag, CoverageMeter, IraMark, TargetPicker } from '../audit-plan/PlanParts';
import { RATING_TONE } from '../audit-plan/planTone';

const fmt = (isoDate: string) =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

// ─────────────────────────────────────────────────────────────────────────────

function KindIcon({ c }: { c: PlanControl }) {
  const Icon = c.check.kind === 'reuse' ? Link2 : c.check.kind === 'manual' ? FileSearch : CircleDashed;
  return <Icon size={13} className={c.check.kind === 'new' ? 'text-brand-600' : c.check.kind === 'reuse' ? 'text-compliant-700' : 'text-ink-400'} aria-hidden />;
}

export function SplitPlanCard({ data, recommendExisting, onChange, onConfirm, onBuildAsOne, onOpenEngagement }: {
  data: SplitPlanData;
  /** Building for a named engagement — the existing option is the recommendation. */
  recommendExisting: boolean;
  onChange: (plan: AuditPlan) => void;
  onConfirm: () => void;
  onBuildAsOne: () => void;
  onOpenEngagement: (id: string) => void;
}) {
  const eng = data.plan.engagements[0];
  const [openKey, setOpenKey] = useState<string | null>(null);
  if (!eng) return null;
  const locked = data.status !== 'open';
  const sel = eng.controls.filter(c => c.selected);
  const newCount = sel.filter(c => c.check.kind === 'new').length;
  const reuseCount = sel.filter(c => c.check.kind === 'reuse').length;
  const cov = coverageFor(eng.process, eng.controls);
  const weeks = eng.phases.reduce((s, p) => s + p.weeks, 0);

  const update = (fn: (e: PlanEngagement) => PlanEngagement) =>
    onChange({ ...data.plan, engagements: [fn(eng)] });

  if (data.status === 'committed' && data.committed) {
    const c = data.committed;
    return (
      <div className="max-w-[44rem] rounded-lg border border-canvas-border bg-canvas-elevated p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Check size={14} className="text-compliant-700" aria-hidden />
              <span className="text-[0.875rem] font-semibold text-ink-900 truncate">{c.engagementName}</span>
              <Pill tone={c.created ? 'info' : 'evidence'}>{c.created ? 'Created' : 'Extended'}</Pill>
            </div>
            <div className="mt-0.5 pl-[1.375rem] text-[0.75rem] text-ink-500 tabular-nums">
              {sel.length} controls · {c.reused} linked to existing workflows · {c.newChecks} new check{c.newChecks === 1 ? '' : 's'}{c.manual ? ` · ${c.manual} manual` : ''}
            </div>
          </div>
          <Button variant="outline" size="sm" rightIcon={<ExternalLink size={12} />} onClick={() => onOpenEngagement(c.engagementId)}>
            Open engagement
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`max-w-[44rem] rounded-lg border border-canvas-border bg-canvas-elevated ${locked ? 'opacity-70' : ''}`}>
      <div className="p-4 pb-3">
        <div className="flex items-start gap-3">
          <IraMark size={26} />
          <div className="min-w-0">
            <div className="text-[0.9375rem] font-semibold text-ink-900">
              This prompt covers {eng.controls.length} separate tests
            </div>
            <p className="text-[0.8125rem] text-ink-600 leading-relaxed">
              One workflow per test keeps each exception table clean and each control's evidence separate. Here's the plan:
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400 mb-1.5">Engagement</div>
        <TargetPicker
          engagement={eng}
          disabled={locked}
          recommended={recommendExisting ? 'existing' : 'new'}
          onChange={target => update(e => ({ ...e, target }))}
        />
        {eng.target.kind === 'new' && !locked && (
          <input
            value={eng.name}
            onChange={e => update(x => ({ ...x, name: e.target.value }))}
            aria-label="New engagement name"
            className="mt-2 w-full h-8 rounded-md border border-canvas-border px-2.5 text-[0.8125rem] text-ink-900 outline-none focus:border-brand-300 focus:ring-2 focus:ring-primary/10"
          />
        )}
      </div>

      <div className="px-4 pb-3">
        <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400 mb-1.5">Controls & checks</div>
        <ul className="rounded-md border border-canvas-border divide-y divide-canvas-border">
          {eng.controls.map(c => {
            const open = openKey === c.id;
            return (
              <li key={c.id} className={c.selected ? '' : 'opacity-50'}>
                <div className="flex items-center gap-2.5 px-3 py-2.5">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={c.selected}
                    aria-label={`Include ${c.title}`}
                    disabled={locked}
                    onClick={() => update(e => withPhases({ ...e, controls: e.controls.map(x => (x.id === c.id ? { ...x, selected: !x.selected } : x)) }))}
                    className={`size-4 rounded border flex items-center justify-center shrink-0 cursor-pointer disabled:cursor-default ${c.selected ? 'bg-brand-600 border-brand-600 text-white' : 'border-ink-300 bg-white'}`}
                  >
                    {c.selected && <Check size={11} strokeWidth={3} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenKey(open ? null : c.id)}
                    aria-expanded={open}
                    className="min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 text-[0.6875rem] text-ink-500">
                      <span className="font-mono">{c.controlId}</span>
                      <span aria-hidden>·</span>
                      <span className="truncate">{c.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-ink-900">
                      <KindIcon c={c} />
                      <span className="truncate">{c.check.name}</span>
                    </div>
                  </button>
                  <CheckTag check={c.check} />
                </div>
                {open && (
                  <div className="px-3 pb-2.5 pl-[2.375rem] text-[0.75rem] text-ink-500 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span>Risk:</span> <span className="text-ink-700">{c.riskTitle}</span> <Pill tone={RATING_TONE[c.riskRating]}>{c.riskRating}</Pill>
                    </div>
                    <div className="text-ink-600">{c.check.description}</div>
                    {c.check.impactReasons.map(r => <div key={r}>— {r}</div>)}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-[1fr_13rem] gap-4 items-end">
        <CoverageMeter coverage={cov} label={`${Array.from(new Set([eng.process, ...eng.controls.map(c => c.process)])).join(' + ')} coverage`} compact />
        <div className="text-[0.75rem] text-ink-500">
          <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400">Timeline</div>
          <div className="tabular-nums text-ink-700">{weeks} weeks · starts {eng.phases[0] ? fmt(eng.phases[0].start) : '—'}</div>
          <div className="truncate" title={eng.phases.map(p => p.label).join(' → ')}>{eng.phases.map(p => p.label.split(' ')[0]).join(' → ')}</div>
        </div>
      </div>

      {data.status === 'open' && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-canvas-border">
          <button
            type="button"
            onClick={onBuildAsOne}
            className="text-[0.8125rem] font-medium text-ink-500 hover:text-ink-900 cursor-pointer"
          >
            Build as one workflow instead
          </button>
          <button
            type="button"
            disabled={sel.length === 0}
            onClick={onConfirm}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-gradient-to-r from-brand-600 to-fuchsia-600 text-white text-[0.8125rem] font-semibold hover:opacity-95 disabled:opacity-40 transition-opacity cursor-pointer disabled:cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            {eng.target.kind === 'new' ? 'Create engagement' : 'Add to engagement'}
            {newCount > 0 ? ` & build ${newCount} check${newCount === 1 ? '' : 's'}` : ` & link ${reuseCount}`}
            <ArrowRight size={14} />
          </button>
        </div>
      )}
      {data.status === 'declined' && (
        <div className="px-4 py-2.5 border-t border-canvas-border text-[0.75rem] text-ink-500">Building as a single workflow instead.</div>
      )}
    </div>
  );
}

export function AgentNudgeCard({ data, onSwitch, onKeep }: { data: NudgeData; onSwitch: () => void; onKeep: () => void }) {
  return (
    <div className="max-w-[40rem] rounded-lg border border-canvas-border bg-canvas-elevated p-4">
      <div className="flex items-start gap-3">
        <span className="size-7 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
          <ShieldCheck size={15} aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="text-[0.875rem] font-semibold text-ink-900">This reads like {data.checks.length} control tests</div>
          <p className="mt-0.5 text-[0.8125rem] text-ink-600 leading-relaxed">
            {data.checks.join(' · ')}. The GRC agent can split them into separate checks, each linked to a control, under one engagement.
            The General agent will build one analysis covering all of it.
          </p>
        </div>
      </div>
      {data.status === 'open' ? (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onKeep}>Keep as one General workflow</Button>
          <Button variant="primary" size="sm" leftIcon={<ShieldCheck size={13} />} onClick={onSwitch}>Switch to GRC agent</Button>
        </div>
      ) : (
        <div className="mt-2 text-[0.75rem] text-ink-500">
          {data.status === 'switched' ? 'Switched to the GRC agent in a new chat.' : 'Kept as one General workflow.'}
        </div>
      )}
    </div>
  );
}

/** Pinned above the composer while Ira builds a plan's new checks in turn. */
export function BuildQueueBar({ queue, onSkip, onStop }: { queue: BuildQueue; onSkip: () => void; onStop: () => void }) {
  const total = queue.items.length;
  const done = queue.items.filter(i => i.status === 'built').length;
  const current = queue.items[queue.index];
  return (
    <div className="rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2.5" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <WorkflowIcon size={14} className="text-brand-600 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="text-[0.75rem] text-ink-500 truncate">
            <span className="font-medium text-ink-900">Building {Math.min(queue.index + 1, total)} of {total}</span>
            {current ? <> · {current.name}</> : null}
            <span className="text-ink-400"> · {queue.engagementName}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-1" aria-hidden>
            {queue.items.map(i => (
              <span
                key={i.checkId}
                title={`${i.name} — ${i.status}`}
                className={`h-1.5 flex-1 rounded-full ${
                  i.status === 'built' ? 'bg-brand-600' : i.status === 'building' ? 'bg-brand-300' : i.status === 'skipped' ? 'bg-ink-300' : 'bg-paper-100'
                }`}
              />
            ))}
          </div>
        </div>
        <span className="font-mono tabular-nums text-[0.75rem] text-ink-500 shrink-0">{done}/{total}</span>
        <Button variant="ghost" size="sm" leftIcon={<SkipForward size={12} />} onClick={onSkip} title="Leave this check as a draft and move on">Skip</Button>
        <Button variant="ghost" size="sm" leftIcon={<Square size={10} />} onClick={onStop} title="Stop — unbuilt checks stay as drafts">Stop</Button>
      </div>
    </div>
  );
}


export function SplitSummaryCard({ data, onOpenEngagement, onOpenLibrary }: {
  data: SplitSummaryData;
  onOpenEngagement: (id: string) => void;
  onOpenLibrary: () => void;
}) {
  return (
    <div className="max-w-[40rem] rounded-lg border border-canvas-border bg-canvas-elevated p-4">
      <div className="flex items-center gap-2">
        <Layers size={15} className="text-brand-600" aria-hidden />
        <span className="text-[0.875rem] font-semibold text-ink-900">{data.engagementName}</span>
      </div>
      <ul className="mt-2 space-y-1">
        {data.built.map(n => (
          <li key={n} className="flex items-center gap-2 text-[0.8125rem] text-ink-700"><Check size={13} className="text-compliant-700" aria-hidden /> {n}</li>
        ))}
        {data.drafts.map(n => (
          <li key={n} className="flex items-center gap-2 text-[0.8125rem] text-ink-500"><CircleDashed size={13} aria-hidden /> {n} <span className="text-ink-400">— draft</span></li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" rightIcon={<ExternalLink size={12} />} onClick={() => onOpenEngagement(data.engagementId)}>Open engagement</Button>
        <Button variant="outline" size="sm" onClick={onOpenLibrary}>Workflow Library</Button>
      </div>
    </div>
  );
}
