import { useState } from 'react';
import { AlertTriangle, FileSearch, RotateCcw, ArrowRight } from 'lucide-react';
import { Button } from '../../../shared/Button';
import { useToast } from '../../../shared/Toast';
import { useAtrUpload } from '../AtrUploadContext';
import { WizardFooter } from '../footerSlot';
import ObservationExtractCard from '../components/ObservationExtractCard';
import { setFieldValue, recomputeCompleteness, hasUnresolved } from '../observationFields';
import type { ExtractedObservation, ExtractedFieldKey } from '../types';

type SummaryFilter = 'all' | 'complete' | 'issues';

/** Screen 4 — extraction summary & selection. The most validation-heavy screen. */
export default function Step4ExtractionSummary({ onContinue }: { onContinue: () => void }) {
  const { state, updateSession, reset } = useAtrUpload();
  const { addToast } = useToast();
  const session = state.session;
  const [filter, setFilter] = useState<SummaryFilter>('all');

  if (!session) return null;
  const { observations, annexures } = session;

  // ── Mutators (all funnel through updateSession → persists + stamps "Saved") ──
  const updateObs = (obsId: string, fn: (o: ExtractedObservation) => ExtractedObservation) =>
    updateSession(s => ({ ...s, observations: s.observations.map(o => (o.id === obsId ? fn(o) : o)) }));

  const toggleSelect = (obsId: string) => updateObs(obsId, o => ({ ...o, selected: !o.selected }));
  const setAll = (value: boolean) => updateSession(s => ({ ...s, observations: s.observations.map(o => ({ ...o, selected: value })) }));

  const editField = (obsId: string, key: ExtractedFieldKey, value: string) =>
    updateObs(obsId, o => setFieldValue(o, key, value));

  const resolve = (obsId: string, key: ExtractedFieldKey, mode: 'fill' | 'skip' | 'reset', value?: string) =>
    updateObs(obsId, o => {
      let next = o;
      if (mode === 'fill' && value !== undefined) next = setFieldValue(next, key, value);
      const missingFields = next.missingFields.map(f =>
        f.key !== key ? f
        : mode === 'fill' ? { ...f, state: 'filled-by-user' as const, value }
        : mode === 'skip' ? { ...f, state: 'skipped' as const }
        : { ...f, state: 'missing' as const, value: undefined },
      );
      next = { ...next, missingFields };
      return { ...next, completeness: recomputeCompleteness(next) };
    });

  // ── Derived ──
  const annexFor = (obsId: string) => annexures.filter(a => a.observationId === obsId);
  const rowsFor = (obsId: string) => annexFor(obsId).reduce((n, a) => n + a.rows.length, 0);

  const obsWithIssues = observations.filter(hasUnresolved);
  const completeCount = observations.filter(o => o.completeness === 'Complete').length;
  const selected = observations.filter(o => o.selected);
  const selectedUnresolved = selected.filter(hasUnresolved);

  // "Only complete" must never hide a selected observation that still blocks
  // Continue — if it would, keep "All" and explain why.
  const setFilterGuarded = (next: SummaryFilter) => {
    if (next === 'complete' && selectedUnresolved.length > 0) {
      addToast({ type: 'info', message: `Showing all observations — ${selectedUnresolved.length} selected still ${selectedUnresolved.length === 1 ? 'needs' : 'need'} attention before you can continue.` });
      setFilter('all');
      return;
    }
    setFilter(next);
  };

  const visible = observations.filter(o =>
    filter === 'all' ? true : filter === 'complete' ? o.completeness === 'Complete' : hasUnresolved(o),
  );

  // Navigation is never blocked — you can move forward at any time. The note
  // below is advisory only (e.g. nothing selected → an empty ATR).
  const canContinue = true;
  const blockReason = selected.length === 0
    ? 'Nothing selected — pick observations, or continue with an empty ATR.'
    : selectedUnresolved.length > 0
      ? `${selectedUnresolved.length} selected still ${selectedUnresolved.length === 1 ? 'needs' : 'need'} fields — you can continue anyway.`
      : null;

  // ── Zero-observations empty state ──
  if (observations.length === 0) {
    return (
      <div className="rounded-[12px] border border-dashed border-canvas-border p-12 text-center max-w-[640px] mx-auto">
        <FileSearch size={26} className="text-ink-300 mx-auto mb-3" aria-hidden="true" />
        <h3 className="text-[15px] font-semibold text-ink-800 mb-1">No observations found</h3>
        <p className="text-[13px] text-ink-500 mb-5 max-w-[420px] mx-auto">We couldn't extract any observations from this report. Try the structured template approach, or upload a clearer report.</p>
        <Button variant="primary" leftIcon={<RotateCcw size={15} />} onClick={reset}>Start over</Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Heading — plain title line, no card chrome */}
      <div className="shrink-0 mb-2.5 flex items-baseline justify-between gap-4">
        <h2 className="text-[1.0625rem] font-semibold text-ink-900 leading-tight">
          {observations.length} observation{observations.length === 1 ? '' : 's'} found
        </h2>
        <span className="shrink-0 text-[12px] text-ink-400 tabular-nums">{Math.round(session.confidence * 100)}% confidence</span>
      </div>

      {/* Missing-fields alert — the one blocker that needs action, kept loud. */}
      {obsWithIssues.length > 0 && (
        <div className="shrink-0 mb-2.5 flex items-center gap-2.5 rounded-[10px] border border-mitigated/30 bg-mitigated-50 px-3.5 py-2 text-[12.5px] text-mitigated-700">
          <AlertTriangle size={15} className="shrink-0" aria-hidden="true" />
          <span className="flex-1">
            <span className="font-semibold">{obsWithIssues.length} missing some fields.</span> Fill or skip to continue.
          </span>
          {filter !== 'issues' && (
            <button onClick={() => setFilter('issues')} className="shrink-0 inline-flex items-center gap-1 h-7 px-2.5 text-[11.5px] font-semibold text-mitigated-700 border border-mitigated/40 hover:bg-mitigated/10 rounded-[6px] cursor-pointer transition-colors">
              Review <ArrowRight size={12} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {/* Minimal toolbar — selection count + a single select/clear toggle on the
          left, the filter on the right. No boxed card chrome. */}
      <div className="shrink-0 mb-2.5 flex items-center justify-between gap-4">
        <div className="text-[12.5px] text-ink-600">
          <span className="font-semibold tabular-nums text-ink-900">{selected.length}</span> of {observations.length} selected
          <span className="mx-2 text-canvas-border" aria-hidden="true">·</span>
          {selected.length === observations.length
            ? <button onClick={() => setAll(false)} className="font-medium text-ink-500 hover:text-ink-800 hover:underline cursor-pointer">Clear all</button>
            : <button onClick={() => setAll(true)} className="font-medium text-brand-700 hover:underline cursor-pointer">Select all</button>}
        </div>
        <SegmentedFilter
          value={filter}
          onChange={setFilterGuarded}
          counts={{ all: observations.length, complete: completeCount, issues: obsWithIssues.length }}
        />
      </div>

      {/* Observation list — scrolls within its own region; heading/toolbar stay put */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {visible.length > 0 ? (
          <div className="rounded-[12px] border border-canvas-border bg-canvas-elevated overflow-hidden divide-y divide-canvas-border">
            {visible.map(o => (
              <ObservationExtractCard
                key={o.id}
                obs={o}
                linkedAnnexures={annexFor(o.id).length}
                linkedRows={rowsFor(o.id)}
                onToggleSelect={() => toggleSelect(o.id)}
                onEditField={(key, value) => editField(o.id, key, value)}
                onResolve={(key, mode, value) => resolve(o.id, key, mode, value)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[12px] border border-dashed border-canvas-border p-8 text-center text-[13px] text-ink-500">
            No observations match this filter.
          </div>
        )}
      </div>

      {/* Footer — pinned below the scroll area */}
      <WizardFooter>
        <div className="flex items-center justify-between gap-4 border-t border-canvas-border bg-canvas-elevated px-6 py-3">
          <p className="text-[12px] text-ink-500">
            {blockReason ?? <span className="text-compliant-700 font-medium">{selected.length} selected — ready for annexures.</span>}
          </p>
          <Button variant="primary" size="md" rightIcon={<ArrowRight size={15} />} disabled={!canContinue} onClick={onContinue} title={blockReason ?? undefined}>
            Continue to Annexures
          </Button>
        </div>
      </WizardFooter>
    </div>
  );
}

/** Segmented filter with inline counts — folds the only useful stat (how many
 *  are done vs. need attention) into the control that acts on it. */
function SegmentedFilter({ value, onChange, counts }: {
  value: SummaryFilter;
  onChange: (f: SummaryFilter) => void;
  counts: { all: number; complete: number; issues: number };
}) {
  const opts: { key: SummaryFilter; label: string; n: number }[] = [
    { key: 'all', label: 'All', n: counts.all },
    { key: 'complete', label: 'Complete', n: counts.complete },
    { key: 'issues', label: 'Issues', n: counts.issues },
  ];
  return (
    <div className="inline-flex items-center rounded-[8px] border border-canvas-border bg-canvas p-0.5">
      {opts.map(o => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[6px] text-[12px] font-medium cursor-pointer transition-colors ${
              active ? 'bg-canvas-elevated text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800'
            }`}
          >
            {o.label}
            <span className={`tabular-nums ${active ? 'text-ink-500' : 'text-ink-400'}`}>{o.n}</span>
          </button>
        );
      })}
    </div>
  );
}
