/**
 * Shared pieces for rendering an AuditPlan — used by the Audit with AI page
 * and the Ask IRA split-plan card, so a check reads the same in both.
 *
 * Tone rules (DESIGN.md): severity is a spelled-out Pill, never a colour
 * alone; meters are flat; brand is the only accent.
 */
import { Check, CircleDashed, Link2, Sparkles, FileSearch, History } from 'lucide-react';
import { Pill } from '../shared/StatusBadge';
import type { PlanCheck, PlanControl, PlanCoverage, PlanEngagement, PlanPhase } from '../../data/auditPlan';
import { RATING_TONE } from './planTone';


/** The Ira mark — the one gradient a surface may carry. */
export function IraMark({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-fuchsia-500 text-white shrink-0"
      style={{ width: size, height: size }}
    >
      <Sparkles size={Math.round(size * 0.5)} strokeWidth={2.25} />
    </span>
  );
}

/** How a control is evidenced: reused workflow / new check (+impact) / manual. */
export function CheckTag({ check }: { check: PlanCheck }) {
  if (check.kind === 'reuse') {
    return (
      <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-compliant-50 text-compliant-700 text-[0.75rem] font-medium whitespace-nowrap">
        <Link2 size={12} aria-hidden /> Reuses existing
      </span>
    );
  }
  if (check.kind === 'manual') {
    return (
      <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-paper-100 text-ink-600 text-[0.75rem] font-medium whitespace-nowrap">
        <FileSearch size={12} aria-hidden /> Manual test
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-brand-50 text-brand-700 text-[0.75rem] font-medium whitespace-nowrap">
        <CircleDashed size={12} aria-hidden /> Needs data
      </span>
      <Pill tone={RATING_TONE[check.impact]}>{check.impact} impact</Pill>
    </span>
  );
}

/** Before → after meter. Flat bars: ink for what exists, brand for the lift. */
export function CoverageMeter({ coverage, label = 'Automated test coverage', compact = false }: {
  coverage: PlanCoverage;
  label?: string;
  compact?: boolean;
}) {
  const { beforePct, afterPct, liftPts, before, after, universe } = coverage;
  return (
    <div className={compact ? '' : 'rounded-lg border border-canvas-border bg-canvas-elevated p-4'}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.75rem] font-medium text-ink-600">{label}</span>
        <span className="font-mono tabular-nums text-[0.8125rem] text-ink-900">
          {beforePct}% <span className="text-ink-400">→</span> <span className="font-semibold text-brand-700">{afterPct}%</span>
        </span>
      </div>
      <div
        className="relative mt-2 h-2 rounded-full bg-paper-100 overflow-hidden"
        role="img"
        aria-label={`Coverage from ${beforePct}% to ${afterPct}%`}
      >
        <div className="absolute inset-y-0 left-0 bg-brand-300" style={{ width: `${afterPct}%` }} />
        <div className="absolute inset-y-0 left-0 bg-ink-500" style={{ width: `${beforePct}%` }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[0.6875rem] text-ink-500">
        <span className="tabular-nums">
          {before} of {universe} key controls tested today · {after} after
        </span>
        {liftPts > 0 && <span className="font-medium text-brand-700 tabular-nums whitespace-nowrap shrink-0 pl-2">+{liftPts} pts scope</span>}
      </div>
    </div>
  );
}

/** One control and the check that tests it. Selectable. */
export function ControlCheckCard({ control, onToggle, disabled }: {
  control: PlanControl;
  onToggle?: () => void;
  disabled?: boolean;
}) {
  const { check } = control;
  const selectable = !!onToggle && !disabled;
  return (
    <div
      className={`group rounded-lg border bg-canvas-elevated p-4 transition-colors ${
        control.selected ? 'border-canvas-border hover:border-brand-200' : 'border-dashed border-canvas-border opacity-60'
      }`}
    >
      <div className="flex items-start gap-3">
        {onToggle && (
          <button
            type="button"
            role="checkbox"
            aria-checked={control.selected}
            aria-label={`Include ${control.title}`}
            disabled={!selectable}
            onClick={onToggle}
            className={`mt-0.5 size-4 rounded border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
              control.selected ? 'bg-brand-600 border-brand-600 text-white' : 'border-ink-300 bg-white hover:border-ink-400'
            }`}
          >
            {control.selected && <Check size={11} strokeWidth={3} />}
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[0.6875rem] text-ink-500">
                <span className="font-mono">{control.controlId}</span>
                <span aria-hidden>·</span>
                <span>{control.subProcess}</span>
                {control.isKey && <span className="font-medium text-ink-700">Key</span>}
              </div>
              <h4 className="mt-0.5 text-[0.875rem] font-semibold text-ink-900 leading-snug">{control.title}</h4>
            </div>
            <Pill tone={RATING_TONE[control.riskRating]}>{control.riskRating} risk</Pill>
          </div>
          <p className="mt-1 text-[0.8125rem] text-ink-600 leading-relaxed">{control.description}</p>

          {/* The check */}
          <div className="mt-3 rounded-md bg-paper-50 border border-paper-300/60 px-3 py-2.5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="text-[0.625rem] font-semibold uppercase tracking-wider text-ink-400">
                  {check.kind === 'manual' ? 'Test procedure' : 'Check'} · {check.cadence}
                </div>
                <div className="text-[0.8125rem] font-medium text-ink-900 truncate">{check.name}</div>
              </div>
              <CheckTag check={check} />
            </div>
            <ul className="mt-1.5 space-y-0.5">
              {check.impactReasons.map(r => (
                <li key={r} className="text-[0.75rem] text-ink-500 leading-snug">— {r}</li>
              ))}
            </ul>
          </div>

          {control.priorFinding && (
            <div className="mt-2 flex items-center gap-1.5 text-[0.75rem] text-high-700">
              <History size={12} aria-hidden />
              <span>Repeat finding · {control.priorFinding}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Counts row for an engagement: reuse / new / manual. */
export function CheckMix({ controls }: { controls: PlanControl[] }) {
  const sel = controls.filter(c => c.selected);
  const n = (k: PlanCheck['kind']) => sel.filter(c => c.check.kind === k).length;
  const items = [
    { label: 'reuse existing', value: n('reuse') },
    { label: 'need data', value: n('new') },
    { label: 'manual', value: n('manual') },
  ];
  return (
    <div className="flex items-center gap-4 text-[0.75rem] text-ink-500">
      <span><span className="font-mono tabular-nums font-semibold text-ink-900">{sel.length}</span> controls</span>
      {items.map(i => (
        <span key={i.label}><span className="font-mono tabular-nums font-semibold text-ink-900">{i.value}</span> {i.label}</span>
      ))}
    </div>
  );
}

const fmt = (isoDate: string) =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** Flat Gantt across engagements. Each row is an engagement; each segment a phase. */
export function PlanGantt({ engagements }: { engagements: PlanEngagement[] }) {
  const rows = engagements.filter(e => e.selected && e.phases.length > 0);
  if (rows.length === 0) return null;
  const toDay = (d: string) => new Date(`${d}T00:00:00Z`).getTime() / 86_400_000;
  const min = Math.min(...rows.map(e => toDay(e.phases[0].start)));
  const max = Math.max(...rows.map(e => toDay(e.phases[e.phases.length - 1].end)));
  const span = Math.max(1, max - min);
  // Week ticks.
  const ticks: string[] = [];
  for (let d = min; d <= max; d += 14) ticks.push(new Date(d * 86_400_000).toISOString().slice(0, 10));
  const PHASE_CLS: Record<PlanPhase['key'], string> = {
    planning: 'bg-ink-300',
    data: 'bg-evidence-100 text-evidence-700',
    build: 'bg-brand-200 text-brand-800',
    fieldwork: 'bg-brand-600 text-white',
    review: 'bg-ink-500 text-white',
    reporting: 'bg-ink-700 text-white',
  };
  return (
    <div className="rounded-lg border border-canvas-border bg-canvas-elevated">
      <div className="relative ml-[13rem] mr-4 h-7 border-b border-canvas-border">
        {ticks.map(t => (
          <span
            key={t}
            className="absolute top-2 text-[0.625rem] font-mono text-ink-400 -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${((toDay(t) - min) / span) * 100}%` }}
          >
            {fmt(t)}
          </span>
        ))}
      </div>
      <ul>
        {rows.map(e => (
          <li key={e.id} className="flex items-center border-b border-canvas-border last:border-b-0">
            <div className="w-[13rem] shrink-0 px-4 py-3">
              <div className="text-[0.6875rem] font-mono text-ink-500">{e.process}</div>
              <div className="text-[0.8125rem] font-medium text-ink-900 truncate" title={e.name}>{e.name}</div>
            </div>
            <div className="relative flex-1 mr-4 h-8">
              {e.phases.map(p => {
                const left = ((toDay(p.start) - min) / span) * 100;
                const width = Math.max(1.5, ((toDay(p.end) - toDay(p.start) + 1) / span) * 100);
                return (
                  <div
                    key={p.key}
                    title={`${p.label} · ${fmt(p.start)} – ${fmt(p.end)} · ${p.weeks} wk`}
                    className={`absolute top-1 h-6 rounded-sm px-1.5 flex items-center text-[0.625rem] font-medium overflow-hidden ${PHASE_CLS[p.key]}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                  >
                    {/* Label only where it fits; the tooltip and legend carry the rest. */}
                    <span className="truncate">{width > 11 ? p.label.replace(/^Build (\d+) new checks?$/, 'Build $1') : ''}</span>
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 border-t border-canvas-border text-[0.6875rem] text-ink-500">
        {(Object.keys(PHASE_CLS) as PlanPhase['key'][]).map(k => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={`size-2.5 rounded-sm ${PHASE_CLS[k].split(' ')[0]}`} aria-hidden />
            {{ planning: 'Planning', data: 'Data readiness', build: 'Build checks', fieldwork: 'Fieldwork', review: 'Review', reporting: 'Reporting' }[k]}
          </span>
        ))}
      </div>
    </div>
  );
}

/** New engagement vs the best-matching existing one. */
export function TargetPicker({ engagement, onChange, disabled, recommended = 'new' }: {
  engagement: PlanEngagement;
  onChange: (target: PlanEngagement['target']) => void;
  disabled?: boolean;
  /** Which option carries the Recommended label. */
  recommended?: 'new' | 'existing';
}) {
  const match = engagement.existingMatch;
  const isNew = engagement.target.kind === 'new';
  const opt = (active: boolean, title: string, sub: string, onClick: () => void, recommended?: boolean) => (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex-1 min-w-0 text-left rounded-lg border px-3 py-2.5 transition-colors cursor-pointer disabled:cursor-default ${
        active ? 'border-brand-600 bg-brand-50/60' : 'border-canvas-border bg-white hover:border-brand-200'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`size-3.5 rounded-full border flex items-center justify-center shrink-0 ${active ? 'border-brand-600' : 'border-ink-300'}`}>
          {active && <span className="size-1.5 rounded-full bg-brand-600" />}
        </span>
        <span className="text-[0.8125rem] font-medium text-ink-900 truncate">{title}</span>
        {recommended && <span className="text-[0.625rem] font-semibold uppercase tracking-wider text-brand-700">Recommended</span>}
      </div>
      <div className="mt-0.5 pl-[1.375rem] text-[0.75rem] text-ink-500 truncate">{sub}</div>
    </button>
  );
  return (
    <div role="radiogroup" aria-label="Where these checks go" className="flex flex-col sm:flex-row gap-2">
      {opt(isNew, 'New engagement', engagement.name, () => onChange({ kind: 'new' }), recommended === 'new')}
      {match && opt(
        !isNew,
        'Add to existing',
        match.engagementName,
        () => onChange({ kind: 'existing', engagementId: match.engagementId, engagementName: match.engagementName }),
        recommended === 'existing',
      )}
    </div>
  );
}
