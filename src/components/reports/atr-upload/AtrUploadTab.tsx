import { Check, ArrowLeft } from 'lucide-react';
import { AtrUploadProvider, useAtrUpload } from './AtrUploadContext';
import { seedSession, seedEmptySession } from './mockExtraction';
import { handoffToManageExceptions } from './handoff';
import { useAuditLog } from '../../../context/AdminDataContext';
import type { WizardStage, UploadedFile, UploadMethod, ReportMeta } from './types';
import type { AtrReportData } from '../atrTypes';
import Step1MethodSelect from './screens/Step1MethodSelect';
import Step2aTemplateDownload from './screens/Step2aTemplateDownload';
import Step2bReportUpload from './screens/Step2bReportUpload';
import Step3Processing from './screens/Step3Processing';
import Step4ExtractionSummary from './screens/Step4ExtractionSummary';
import Step5AnnexureMapping from './screens/Step5AnnexureMapping';
import Step7AtrPreview from './screens/Step7AtrPreview';
import { useToast } from '../../shared/Toast';

// ─── Stepper ───
const STEPS: { stage: WizardStage; label: string }[] = [
  { stage: 'method', label: 'Method' },
  { stage: 'upload', label: 'Upload' },
  { stage: 'summary', label: 'Extraction' },
  { stage: 'annexures', label: 'Annexures' },
  { stage: 'preview', label: 'ATR Preview' },
];
// 'template' (Screen 2A) shares the "Upload" step slot in the rail.
// 'processing' has no rail pill of its own — it's surfaced as a corner toast
// (see Step3Processing) and the rail sits on "Extraction" while it runs.
// 'decision' is retired — managing exceptions now happens per-observation from
// the generated ATR (Step 7), so it maps to the ATR Preview slot.
const STAGE_INDEX: Record<WizardStage, number> = {
  method: 0, template: 1, upload: 1, processing: 2, summary: 2, annexures: 3, decision: 4, preview: 4,
};

// Display-only progress rail — not clickable. Step navigation happens via the
// single "Back" control below the rail (forward is driven by each screen's CTA).
function Stepper({ stage }: { stage: WizardStage }) {
  const active = STAGE_INDEX[stage];
  return (
    <ol className="flex items-center gap-2 flex-wrap">
      {STEPS.map((s, i) => {
        const done = i < active;
        const isActive = i === active;
        return (
          <li key={s.stage} className="flex items-center gap-2">
            <span
              className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold tabular-nums ${
                done ? 'bg-compliant text-white' : isActive ? 'bg-brand-600 text-white' : 'bg-canvas-border text-ink-500'
              }`}
              aria-current={isActive ? 'step' : undefined}
            >
              {done ? <Check size={11} aria-hidden="true" /> : i + 1}
            </span>
            <span className={`text-[12px] ${isActive ? 'font-semibold text-ink-800' : 'text-ink-500'}`}>{s.label}</span>
            {i < STEPS.length - 1 && <span className="w-6 h-px bg-canvas-border" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

function toUploadedFile(f: File): UploadedFile {
  return {
    id: `uf-${Date.now()}`,
    filename: f.name,
    ext: f.name.split('.').pop()?.toLowerCase() ?? '',
    size: f.size,
    uploadedAt: new Date().toISOString(),
    status: 'uploaded',
  };
}

function AtrUploadInner({ onManageExceptions, onSaveAtr }: {
  onManageExceptions?: () => void;
  onSaveAtr?: (sessionId: string, label: string | undefined, data: AtrReportData) => void;
}) {
  const { state, setMethod, setSession, goTo } = useAtrUpload();
  const { addToast } = useToast();
  const logEvent = useAuditLog();

  // Build the session (with the uploaded file's metadata) up front, then run the
  // processing animation. Seeding before processing keeps refresh-mid-processing
  // resumable, and the mock extraction only needs the filename anyway.
  // Filenames drive the demoable edge cases: *fail*/*corrupt* → upload error,
  // *empty*/*blank* → zero-observations extraction.
  const beginExtraction = (file: File, method: UploadMethod, annexures: File[] = [], meta?: Partial<ReportMeta>) => {
    const name = file.name.toLowerCase();
    if (/fail|corrupt|error/.test(name)) {
      addToast({ type: 'error', message: `"${file.name}" could not be read. Try again or use a different format.` });
      return;
    }
    const empty = /empty|blank/.test(name);
    const session = empty
      ? seedEmptySession(toUploadedFile(file), method, meta)
      : seedSession(toUploadedFile(file), method, annexures.map(toUploadedFile), meta);
    setSession(session);
    logEvent({
      action: 'Create',
      description: `Uploaded "${file.name}" and extracted ${session.observations.length} observation${session.observations.length === 1 ? '' : 's'} for an ATR`,
      module: 'Reports',
      entity: 'ATR Extraction',
    });
    goTo('processing');
  };

  // Per-observation hand-off: send only the exception rows linked to one
  // observation to Manage Exceptions, keeping each observation's cases segregated.
  const goToManageExceptions = (observationId: string) => {
    if (!state.session) return;
    const obs = state.session.observations.find(o => o.id === observationId);
    const n = handoffToManageExceptions(state.session, observationId);
    const label = obs ? (obs.title?.trim() || `Observation #${obs.number}`) : 'an observation';
    logEvent({ action: 'Export', description: `Handed off ${n} exception row${n === 1 ? '' : 's'} from "${label}" to Manage Exceptions`, module: 'Reports', entity: 'Exception Case' });
    if (onManageExceptions) onManageExceptions();
    else addToast({ type: 'warning', message: 'Manage Exceptions is not available in this context.' });
  };

  // Single back control (below the rail) — steps one stage back. The rail itself
  // is display-only; forward movement is driven by each screen's primary CTA.
  const goBack = () => {
    const s = state.stage;
    if (s === 'template' || s === 'upload') goTo('method');
    else if (s === 'summary') goTo(state.method === 'template' ? 'template' : 'upload');
    else if (s === 'annexures') goTo('summary');
    else if (s === 'preview' || s === 'decision') goTo('annexures');
  };
  const canGoBack = state.stage !== 'method' && state.stage !== 'processing';

  const pickMethod = (method: UploadMethod) => {
    setMethod(method);
    goTo(method === 'template' ? 'template' : 'upload');
  };

  return (
    <div className="max-w-[1100px] mx-auto">
      {/* Stepper (centered, width-hugging) with the step-back control parallel
          on its left — sticky so it stays visible while scrolling. */}
      <div className="sticky top-0 z-30 mb-5 print:hidden">
        <div className="relative flex items-center justify-center">
          {canGoBack && (
            <button
              onClick={goBack}
              className="absolute left-0 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-600 hover:text-brand-700 transition-colors cursor-pointer"
            >
              <ArrowLeft size={15} aria-hidden="true" /> Back
            </button>
          )}
          <div className="w-fit max-w-full rounded-[12px] border border-canvas-border bg-canvas-elevated px-5 py-4 shadow-sm">
            <Stepper stage={state.stage} />
          </div>
        </div>
      </div>

      {/* Screen router */}
      {state.stage === 'method' && <Step1MethodSelect onPick={pickMethod} />}
      {state.stage === 'template' && (
        <Step2aTemplateDownload onBack={() => goTo('method')} onUpload={file => beginExtraction(file, 'template')} />
      )}
      {state.stage === 'upload' && (
        <Step2bReportUpload onBack={() => goTo('method')} onExtract={(report, annexures, meta) => beginExtraction(report, 'report', annexures, meta)} />
      )}
      {state.stage === 'processing' && <Step3Processing onDone={() => goTo('summary')} />}
      {state.stage === 'summary' && <Step4ExtractionSummary onContinue={() => goTo('annexures')} />}
      {state.stage === 'annexures' && <Step5AnnexureMapping onBack={() => goTo('summary')} onContinue={() => goTo('preview')} />}
      {(state.stage === 'preview' || state.stage === 'decision') && <Step7AtrPreview onBack={() => goTo('annexures')} onManageExceptions={goToManageExceptions} onSaveAtr={onSaveAtr} />}
    </div>
  );
}

/** The "Generate by Upload" tab — self-contained: owns its own provider so the
 *  wizard state persists independently of the rest of the reports module. */
export default function AtrUploadTab({ onManageExceptions, onSaveAtr }: {
  onManageExceptions?: () => void;
  onSaveAtr?: (sessionId: string, label: string | undefined, data: AtrReportData) => void;
}) {
  return (
    <AtrUploadProvider>
      <AtrUploadInner onManageExceptions={onManageExceptions} onSaveAtr={onSaveAtr} />
    </AtrUploadProvider>
  );
}
