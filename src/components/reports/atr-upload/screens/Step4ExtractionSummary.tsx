import { useState } from 'react';
import { AlertTriangle, FileSearch, RotateCcw, ArrowRight } from 'lucide-react';
import { Button } from '../../../shared/Button';
import { useToast } from '../../../shared/Toast';
import { useAtrUpload } from '../AtrUploadContext';
import { formatBytes } from '../format';
import ObservationExtractCard from '../components/ObservationExtractCard';
import ExtractionRightRail, { type SummaryFilter, type RailBreakdown } from '../components/ExtractionRightRail';
import { setFieldValue, recomputeCompleteness, hasUnresolved } from '../observationFields';
import type { ExtractedObservation, ExtractedFieldKey } from '../types';
import type { AtrClassification, AtrRisk } from '../../atrTypes';

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

  const breakdown: RailBreakdown = {
    classification: { 'Design Deficiency': 0, 'System Deficiency': 0, 'Procedural Non-Compliance': 0 } as Record<AtrClassification, number>,
    risk: { High: 0, Medium: 0, Low: 0 } as Record<AtrRisk, number>,
    totalActionPlans: 0,
    totalAnnexureRows: 0,
  };
  selected.forEach(o => {
    if (o.classification) breakdown.classification[o.classification] += 1;
    if (o.risk) breakdown.risk[o.risk] += 1;
    breakdown.totalActionPlans += o.actionPlans.length;
    breakdown.totalAnnexureRows += rowsFor(o.id);
  });

  // Navigation is never blocked — you can move forward at any time. The note
  // below is advisory only (e.g. nothing selected → an empty ATR).
  const canContinue = true;
  const blockReason = selected.length === 0
    ? 'Nothing selected yet — continue to generate an empty ATR, or pick observations first.'
    : selectedUnresolved.length > 0
      ? `${selectedUnresolved.length} selected observation${selectedUnresolved.length === 1 ? '' : 's'} ${selectedUnresolved.length === 1 ? 'has' : 'have'} unresolved missing fields — you can still continue.`
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
    <div>
      {/* Header banner */}
      <div className="mb-4 rounded-[12px] border border-canvas-border bg-gradient-to-br from-brand-700 to-brand-600 text-white px-5 py-4">
        <h2 className="text-[1.0625rem] font-semibold">
          We found {observations.length} observation{observations.length === 1 ? '' : 's'} and {annexures.length} annexure{annexures.length === 1 ? '' : 's'} in your report
        </h2>
        <p className="text-[12px] text-white/80 mt-0.5">
          {session.file?.filename ?? 'report'}{session.file ? ` · ${formatBytes(session.file.size)}` : ''} · {Math.round(session.confidence * 100)}% extraction confidence
        </p>
      </div>

      {/* Global missing-fields alert — actionable so the blocker is never hidden
          behind a filter. */}
      {obsWithIssues.length > 0 && (
        <div className="mb-4 flex items-center gap-2.5 rounded-[8px] border border-mitigated/30 bg-mitigated-50 px-4 py-3 text-[12.5px] text-mitigated-700">
          <AlertTriangle size={15} className="shrink-0" aria-hidden="true" />
          <span className="flex-1"><span className="font-semibold">{obsWithIssues.length} observation{obsWithIssues.length === 1 ? '' : 's'} {obsWithIssues.length === 1 ? 'has' : 'have'} missing fields.</span> Fill or skip each one before continuing.</span>
          {filter !== 'issues' && (
            <button onClick={() => setFilter('issues')} className="shrink-0 inline-flex items-center gap-1 h-7 px-2.5 text-[11.5px] font-semibold text-mitigated-700 bg-mitigated-50 border border-mitigated/40 hover:bg-mitigated/10 rounded-[6px] cursor-pointer transition-colors">
              Review them <ArrowRight size={12} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
        {/* Main column */}
        <div className="space-y-3 min-w-0">
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
          {visible.length === 0 && (
            <div className="rounded-[12px] border border-dashed border-canvas-border p-8 text-center text-[13px] text-ink-500">
              No observations match this filter.
            </div>
          )}
        </div>

        {/* Sticky right rail */}
        <ExtractionRightRail
          selectedCount={selected.length}
          totalCount={observations.length}
          filter={filter}
          onFilter={setFilterGuarded}
          onSelectAll={() => setAll(true)}
          onDeselectAll={() => setAll(false)}
          breakdown={breakdown}
          canContinue={canContinue}
          blockReason={blockReason}
          onContinue={onContinue}
        />
      </div>
    </div>
  );
}
