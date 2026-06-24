import { useState } from 'react';
import { AlertTriangle, FileSearch, RotateCcw, ArrowRight, CheckCheck } from 'lucide-react';
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
    <div className="h-full flex">
      {/* ── Left rail ──────────────────────────────────────────────────────
          All the controls live here instead of stacked on top of the list, so
          the list claims the full height of the modal. Full-bleed: the rail and
          list run edge-to-edge with the divider spanning top to bottom. */}
      <aside className="w-[240px] shrink-0 flex flex-col px-6 pt-4 pb-4 border-r border-canvas-border">
        <div>
          <h2 className="text-[1.0625rem] font-semibold text-ink-900 leading-tight">
            {observations.length} observation{observations.length === 1 ? '' : 's'} found
          </h2>
          <p className="mt-1 text-[11.5px] text-ink-400">Extracted at <span className="tabular-nums font-medium text-ink-500">{Math.round(session.confidence * 100)}%</span> confidence</p>
        </div>

        {/* Filter as a vertical nav — only 3 states, reads cleaner stacked. */}
        <nav className="mt-5 flex flex-col gap-0.5">
          {([
            { key: 'all', label: 'All observations', n: observations.length },
            { key: 'issues', label: 'Needs review', n: obsWithIssues.length },
          ] as const).map(o => {
            const active = filter === o.key;
            return (
              <button
                key={o.key}
                onClick={() => setFilterGuarded(o.key)}
                aria-pressed={active}
                className={`flex items-center justify-between h-8 px-2.5 rounded-[7px] text-[12.5px] cursor-pointer transition-colors ${
                  active ? 'bg-brand-50 text-brand-800 font-semibold' : 'text-ink-600 font-medium hover:bg-canvas hover:text-ink-900'
                }`}
              >
                <span>{o.label}</span>
                <span className={`tabular-nums text-[11.5px] ${active ? 'text-brand-600' : 'text-ink-400'}`}>{o.n}</span>
              </button>
            );
          })}
        </nav>

        {/* Selection summary + a proper select/clear button (not a text link). */}
        <div className="mt-6 pt-5 border-t border-canvas-border">
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">Adding to this ATR</p>
          <p className="mt-2 text-ink-600">
            <span className="text-[15px] font-semibold tabular-nums text-ink-900">{selected.length}</span>
            <span className="text-[12.5px] text-ink-400"> of {observations.length} observation{observations.length === 1 ? '' : 's'}</span>
          </p>
          {selected.length === observations.length ? (
            <button onClick={() => setAll(false)} className="mt-3 w-full inline-flex items-center justify-center h-8 rounded-[8px] border border-canvas-border text-[12px] font-semibold text-ink-600 hover:bg-canvas hover:text-ink-900 cursor-pointer transition-colors">
              Clear selection
            </button>
          ) : (
            <button onClick={() => setAll(true)} className="mt-3 w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-[8px] border border-brand-200 bg-brand-50 text-[12px] font-semibold text-brand-700 hover:bg-brand-100 cursor-pointer transition-colors">
              <CheckCheck size={13} aria-hidden="true" /> Select all {observations.length}
            </button>
          )}
        </div>

        {/* Issues nudge — pinned to the bottom of the rail, with a real CTA. */}
        {obsWithIssues.length > 0 && filter !== 'issues' && (
          <div className="mt-auto rounded-[10px] border border-mitigated/25 bg-mitigated-50 p-3">
            <div className="flex items-start gap-2 text-[11.5px] leading-snug text-mitigated-700">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
              <p><span className="font-semibold tabular-nums">{obsWithIssues.length}</span> {obsWithIssues.length === 1 ? 'observation needs' : 'observations need'} a few fields before {obsWithIssues.length === 1 ? "it's" : "they're"} ready.</p>
            </div>
            <button onClick={() => setFilterGuarded('issues')} className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 h-7 rounded-[7px] bg-mitigated-600 text-white text-[11.5px] font-semibold hover:bg-mitigated-700 cursor-pointer transition-colors">
              Review {obsWithIssues.length === 1 ? 'it' : 'them'} <ArrowRight size={11} aria-hidden="true" />
            </button>
          </div>
        )}
      </aside>

      {/* ── Right pane: the list, full modal height, full-bleed ───────────── */}
      <div className="flex-1 min-w-0 min-h-0 overflow-y-auto px-6 pt-4 pb-4">
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
