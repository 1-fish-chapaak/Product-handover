import { useState } from 'react';
import { ArrowRight, ArrowLeft, FileText, ListChecks } from 'lucide-react';
import { Button } from '../../../shared/Button';
import { useAtrUpload } from '../AtrUploadContext';
import { WizardFooter } from '../footerSlot';

type Choice = 'generate' | 'manage';

/** Screen 6 — how to proceed after annexure mapping: go straight to the ATR
 *  preview, or review the linked exception cases in Manage Exceptions first.
 *  Cards select a path; the sticky footer's primary button executes it (the
 *  same select→advance pattern the rest of the wizard uses). Mirrors the
 *  decision step in the ATR-Builder modal. */
export default function Step6Decision({ onGenerate, onManageExceptions }: {
  /** Generate ATR only — go straight to the ATR preview. */
  onGenerate: () => void;
  /** Manage exceptions first — hand every linked annexure to case management. */
  onManageExceptions: () => void;
}) {
  const { state, goTo } = useAtrUpload();
  const session = state.session;
  const [choice, setChoice] = useState<Choice>('generate');

  if (!session) return null;

  // Counts shown under the heading — what's flowing into the decision.
  const selectedObs = session.observations.filter(o => o.selected);
  const obsCount = selectedObs.length || session.observations.length;
  // Skipping annexures means nothing is actually linked — don't count the
  // mock's pre-suggested rows, or the subtext claims links that don't exist.
  const linkedRows = session.annexuresSkipped
    ? 0
    : session.annexures
        .filter(a => a.observationId)
        .reduce((n, a) => n + a.rows.length, 0);

  // Manage-Exceptions needs confirmed annexure links. If the user skipped
  // annexures (or none are linked), that path is unavailable — lock to Generate.
  const canManage = !session.annexuresSkipped && linkedRows > 0;
  const active: Choice = canManage ? choice : 'generate';

  return (
    <div className="w-full">
      <h2 className="text-[1.0625rem] font-semibold text-ink-900 leading-tight mb-1">How would you like to proceed?</h2>
      <p className="text-[0.78125rem] text-ink-500 leading-snug mb-6">
        {obsCount} observation{obsCount === 1 ? '' : 's'}{linkedRows > 0 ? ` · ${linkedRows} linked exception row${linkedRows === 1 ? '' : 's'}` : ''}.
      </p>

      <div className="grid grid-cols-2 gap-4 max-w-[720px] items-stretch">
        {/* Generate ATR only */}
        <button
          onClick={() => setChoice('generate')}
          aria-pressed={active === 'generate'}
          className={`relative flex flex-col text-left rounded-xl border p-5 transition-all duration-200 cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 ${active === 'generate' ? 'border-brand-500 bg-brand-50/50 shadow-md shadow-brand-900/[0.06]' : 'border-canvas-border bg-canvas-elevated hover:border-brand-300 hover:bg-brand-50/20 hover:-translate-y-0.5 hover:shadow-md hover:shadow-brand-900/[0.05]'}`}
        >
          <span className={`w-12 h-12 rounded-lg flex items-center justify-center mb-3 transition-all duration-200 ${active === 'generate' ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30 scale-[1.03]' : 'bg-brand-50 text-brand-700'}`}><FileText size={21} aria-hidden="true" /></span>
          <div className="text-base font-semibold text-ink-900 mb-1">Generate ATR only</div>
          <p className="text-xs text-ink-500 leading-relaxed">Skip case management and go straight to the ATR preview. You can come back and manage exceptions later.</p>
          <p className="mt-auto pt-3 inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 bg-brand-50 rounded-sm px-2 py-1">
            <ArrowRight size={11} className="shrink-0" aria-hidden="true" /> Goes straight to the ATR preview.
          </p>
        </button>

        {/* Manage exceptions first */}
        <button
          onClick={() => canManage && setChoice('manage')}
          aria-pressed={active === 'manage'}
          aria-disabled={!canManage}
          title={canManage ? undefined : 'No confirmed annexure links — there are no exception cases to manage.'}
          className={`relative flex flex-col text-left rounded-xl border p-5 transition-all duration-200 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-evidence-600/40 ${!canManage ? 'border-canvas-border bg-canvas-elevated opacity-55 cursor-not-allowed' : active === 'manage' ? 'border-evidence-500 bg-evidence-50/40 shadow-md shadow-brand-900/[0.06] cursor-pointer' : 'border-canvas-border bg-canvas-elevated hover:border-evidence-300 hover:bg-evidence-50/20 hover:-translate-y-0.5 hover:shadow-md hover:shadow-brand-900/[0.05] cursor-pointer'}`}
        >
          <span className={`w-12 h-12 rounded-lg flex items-center justify-center mb-3 transition-all duration-200 ${active === 'manage' ? 'bg-evidence-600 text-white shadow-md shadow-evidence-600/30 scale-[1.03]' : 'bg-evidence-50 text-evidence-700'}`}><ListChecks size={21} aria-hidden="true" /></span>
          <div className="text-base font-semibold text-ink-900 mb-1">Manage exceptions first</div>
          <p className="text-xs text-ink-500 leading-relaxed">Review the exception cases linked to observations before generating. Classify, assign action plans, and review evidence.</p>
          <p className="mt-auto pt-3 inline-flex items-center gap-1.5 text-xs font-medium text-evidence-700 bg-evidence-50 rounded-sm px-2 py-1">
            <ArrowRight size={11} className="shrink-0" aria-hidden="true" /> {canManage ? 'Opens Manage Exceptions — generate the ATR after reviewing.' : 'Unavailable — link annexures to enable this.'}
          </p>
        </button>
      </div>

      {/* Footer — pinned below the scroll area; primary executes the choice. */}
      <WizardFooter>
        <div className="flex items-center justify-between gap-3 flex-wrap border-t border-canvas-border bg-canvas-elevated px-6 py-3">
          <Button variant="ghost" size="md" leftIcon={<ArrowLeft size={15} />} onClick={() => goTo('annexures')}>Back</Button>
          {active === 'generate'
            ? <Button variant="primary" size="md" leftIcon={<FileText size={15} />} rightIcon={<ArrowRight size={15} />} onClick={onGenerate}>Generate ATR</Button>
            : <Button variant="primary" size="md" leftIcon={<ListChecks size={15} />} rightIcon={<ArrowRight size={15} />} onClick={onManageExceptions}>Manage exceptions first</Button>}
        </div>
      </WizardFooter>
    </div>
  );
}
