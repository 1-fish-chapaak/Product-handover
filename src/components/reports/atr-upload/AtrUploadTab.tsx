import { useState, useEffect, useRef } from 'react';
import { Check, ArrowLeft, X, CloudUpload, Loader2, Maximize2 } from 'lucide-react';
import { AtrUploadProvider, useAtrUpload } from './AtrUploadContext';
import { seedSession, seedEmptySession, PROCESSING_MESSAGES, PROCESSING_DURATION_MS } from './mockExtraction';
import { handoffToManageExceptions } from './handoff';
import { saveAtrDraft } from '../atrDraft';
import { toAtrReportData } from './toAtrReportData';
import { useAuditLog } from '../../../context/AdminDataContext';
import { FooterSlotContext } from './footerSlot';
import type { WizardStage, UploadedFile, UploadMethod, ReportMeta } from './types';
import type { AtrReportData } from '../atrTypes';
import Step1MethodSelect from './screens/Step1MethodSelect';
import Step2aTemplateDownload from './screens/Step2aTemplateDownload';
import Step2bReportUpload from './screens/Step2bReportUpload';
import Step3Processing from './screens/Step3Processing';
import Step4ExtractionSummary from './screens/Step4ExtractionSummary';
import Step5AnnexureMapping from './screens/Step5AnnexureMapping';
import Step6Decision from './screens/Step6Decision';
import Step7AtrPreview from './screens/Step7AtrPreview';
import { useToast } from '../../shared/Toast';
import ReportDiscardDialog from '../ReportDiscardDialog';

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
// 'decision' (Screen 6 — generate-only vs manage-exceptions) sits in the final
// "generate" phase alongside the preview, so it shares the ATR Preview slot.
const STAGE_INDEX: Record<WizardStage, number> = {
  method: 0, template: 1, upload: 1, processing: 2, summary: 2, annexures: 3, decision: 4, preview: 4,
};

// Step-back tip per step. Forward is driven by each screen's primary CTA;
// completed steps are clickable to jump back (mirrors the ATR-builder modal).
const STEP_TIP: Record<string, string> = {
  method: 'Choose how to bring in your report',
  upload: 'Upload your report or filled template',
  summary: 'Review and select the extracted observations',
  annexures: 'Link exception annexures to observations',
  preview: 'Generate, edit and save the ATR',
};

// Where clicking a completed step lands. The two upload paths share the
// "Upload" slot, so step 1 resolves to whichever method the user picked.
function stepBackTarget(i: number, method: UploadMethod | null): WizardStage {
  if (i === 0) return 'method';
  if (i === 1) return method === 'template' ? 'template' : 'upload';
  if (i === 2) return 'summary';
  if (i === 3) return 'annexures';
  return 'preview';
}

// Clickable progress rail in the modal header. Completed steps navigate back;
// the active/upcoming steps are inert. Processing locks navigation.
function Stepper({ stage, method, onJump }: { stage: WizardStage; method: UploadMethod | null; onJump: (s: WizardStage) => void }) {
  const active = STAGE_INDEX[stage];
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const state = i < active ? 'done' : i === active ? 'active' : 'todo';
        const canGoBack = state === 'done' && stage !== 'processing';
        const tip = state === 'done' ? 'Click to go back to this step'
          : state === 'active' ? STEP_TIP[s.stage]
          : `Complete Step ${active + 1} to unlock`;
        return (
          <div key={s.stage} className="flex items-center gap-2">
            <button
              type="button"
              title={tip}
              aria-label={canGoBack ? `Go back to ${s.label}` : undefined}
              aria-current={state === 'active' ? 'step' : undefined}
              aria-disabled={!canGoBack}
              onClick={() => canGoBack && onJump(stepBackTarget(i, method))}
              className={`group inline-flex items-center gap-1.5 h-7 pl-1.5 pr-2.5 rounded-full text-[0.75rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 ${state === 'active' ? 'bg-brand-50 text-brand-700' : state === 'done' ? 'bg-compliant-50 text-compliant-700 hover:bg-compliant-100 cursor-pointer' : 'bg-draft-50 text-ink-500 cursor-default'}`}
            >
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[0.625rem] ${state === 'active' ? 'bg-brand-600 text-white' : state === 'done' ? 'bg-compliant text-white' : 'bg-ink-300 text-white'}`}>{state === 'done' ? <Check size={10} aria-hidden="true" /> : i + 1}</span>
              {s.label}
              {canGoBack && <ArrowLeft size={11} className="-mr-0.5 max-w-0 opacity-0 group-hover:max-w-[14px] group-hover:opacity-100 transition-all duration-150" aria-hidden="true" />}
            </button>
            {i < STEPS.length - 1 && <span className="w-5 h-px bg-canvas-border" aria-hidden="true" />}
          </div>
        );
      })}
    </div>
  );
}

// Close-confirm copy, keyed to how much work is on the line. Three tiers so the
// dialog never overstates ("upload" when there's a full extracted ATR) or
// understates ("progress" while a run is mid-flight and would be killed).
type CloseConfirmKind = 'extracting' | 'extracted' | 'upload';
const CLOSE_CONFIRM_COPY: Record<CloseConfirmKind, { title: string; body: string; confirm: string; cancel: string }> = {
  extracting: {
    title: 'Stop the extraction?',
    body: 'Extraction is still running. Closing now cancels it — you’ll need to upload and re-extract to start over.',
    confirm: 'Stop & close',
    cancel: 'Keep extracting',
  },
  extracted: {
    title: 'Discard your progress?',
    body: 'Your extracted ATR — observations, annexure links and any edits on this screen — will be discarded.',
    confirm: 'Discard & close',
    cancel: 'Keep editing',
  },
  upload: {
    title: 'Discard this upload?',
    body: 'Your uploaded report will be discarded and you’ll return to the report list.',
    confirm: 'Discard & close',
    cancel: 'Keep editing',
  },
};


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

function AtrUploadInner({ onClose, onManageExceptions, onSaveAtr, onConfirmOpenChange, onMinimizedChange }: {
  onClose?: () => void;
  onManageExceptions?: () => void;
  onSaveAtr?: (sessionId: string, label: string | undefined, data: AtrReportData) => string;
  /** Fires when the close-confirm opens/closes so the host can hide its own
   *  backdrop and leave a single uniform scrim. */
  onConfirmOpenChange?: (open: boolean) => void;
  /** Fires when the wizard minimizes to / restores from the floating toast, so the
   *  host can drop the backdrop and shrink the container (non-blocking extraction). */
  onMinimizedChange?: (minimized: boolean) => void;
}) {
  const { state, setMethod, setSession, goTo } = useAtrUpload();
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  // The sticky footer DOM node — steps portal their primary CTA into it.
  const [footerEl, setFooterEl] = useState<HTMLElement | null>(null);

  // Extraction runs HERE (not in Step3Processing) so it keeps advancing while the
  // wizard is minimized to a floating toast. Progress/step drive both the full
  // processing screen and the toast.
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(0);
  // Minimized → shown as a small fixed progress toast; the rest of the app is usable.
  const [minimized, setMinimized] = useState(false);
  useEffect(() => { onMinimizedChange?.(minimized); }, [minimized, onMinimizedChange]);

  // Drive the progress whenever we're on the processing stage; on completion,
  // advance to the summary. Survives minimize/restore (lives above the screens).
  const goToRef = useRef(goTo);
  goToRef.current = goTo;
  useEffect(() => {
    if (state.stage !== 'processing') return;
    setProgress(0); setStep(0);
    const start = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / PROCESSING_DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 2);
      setProgress(eased * 100);
      setStep(Math.min(PROCESSING_MESSAGES.length - 1, Math.floor(eased * PROCESSING_MESSAGES.length)));
      if (elapsed < PROCESSING_DURATION_MS) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const done = window.setTimeout(() => goToRef.current('summary'), PROCESSING_DURATION_MS);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(done); };
  }, [state.stage]);

  // Closing mid-flow discards in-progress work — guard every exit past the
  // method picker. The confirm copy scales with how much is on the line: a live
  // extraction (killed), an extracted ATR (observations + edits lost), or just an
  // uploaded file. At the method step there's nothing to lose, so close straight.
  const [confirmClose, setConfirmClose] = useState(false);
  const closeConfirmKind: CloseConfirmKind =
    state.stage === 'processing' ? 'extracting'
    : state.session ? 'extracted'
    : 'upload';
  const hasWorkInProgress = state.stage !== 'method';
  const requestClose = () => {
    if (hasWorkInProgress) setConfirmClose(true);
    else onClose?.();
  };
  // Let the host drop its backdrop while the confirm is up — one scrim, not two.
  useEffect(() => { onConfirmOpenChange?.(confirmClose); }, [confirmClose, onConfirmOpenChange]);

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
    // Minimize to the floating toast so extraction runs without blocking the app.
    setMinimized(true);
    goTo('processing');
  };

  // Per-observation hand-off: send the exception rows linked to one observation
  // to Manage Exceptions, opened in a NEW TAB so the ATR preview stays put.
  const goToManageExceptions = (observationId: string) => {
    if (!state.session) return;
    const obs = state.session.observations.find(o => o.id === observationId);
    const n = handoffToManageExceptions(state.session, observationId, { newTab: true });
    const label = obs ? (obs.title?.trim() || `Observation #${obs.number}`) : 'an observation';
    logEvent({ action: 'Export', description: `Handed off ${n} exception row${n === 1 ? '' : 's'} from "${label}" to Manage Exceptions (new tab)`, module: 'Reports', entity: 'Exception Case' });
  };

  // Whole-report hand-off from the decision screen (Step 6): send every linked
  // annexure to Manage Exceptions at once, then navigate. The wizard's persisted
  // ATR-Preview stage means "Back" from case management resumes the user here.
  const goToManageExceptionsAll = () => {
    if (!state.session) return;
    // Persist the wizard at the preview stage AND park the ATR draft, so the
    // Manage-Exceptions view shows its "Return to ATR & generate" affordance and
    // returning reopens this wizard exactly where it left off (see ReportsView).
    goTo('preview');
    saveAtrDraft(toAtrReportData(state.session));
    const n = handoffToManageExceptions(state.session);
    logEvent({ action: 'Export', description: `Handed off ${n} exception row${n === 1 ? '' : 's'} from the uploaded report to Manage Exceptions`, module: 'Reports', entity: 'Exception Case' });
    if (onManageExceptions) onManageExceptions();
    else addToast({ type: 'warning', message: 'Manage Exceptions is not available in this context.' });
  };

  const pickMethod = (method: UploadMethod) => {
    setMethod(method);
    goTo(method === 'template' ? 'template' : 'upload');
  };

  if (minimized) {
    const done = state.stage !== 'processing';
    const obsCount = state.session?.observations.length ?? 0;
    return (
      <FooterSlotContext.Provider value={footerEl}>
        <div className="p-4">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-[10px] bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
              {done ? <Check size={16} aria-hidden="true" /> : <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-ink-900 leading-tight">{done ? 'Extraction complete' : 'Extracting your report'}</div>
              <div className="text-[11.5px] text-ink-500 truncate mt-0.5">{done ? `${obsCount} observation${obsCount === 1 ? '' : 's'} ready` : PROCESSING_MESSAGES[step]}</div>
            </div>
            {!done && <span className="text-[13px] font-bold tabular-nums text-brand-700 shrink-0">{Math.round(progress)}%</span>}
            <button onClick={requestClose} className="w-7 h-7 rounded-full text-ink-400 hover:text-ink-800 hover:bg-draft-50 flex items-center justify-center cursor-pointer shrink-0" aria-label="Close"><X size={14} /></button>
          </div>
          {!done && (
            <div className="mt-3 h-1.5 rounded-full bg-brand-50 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-500 transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          )}
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[11px] text-ink-400">{done ? 'Your ATR is ready to review.' : 'Running in the background — keep working.'}</span>
            <button onClick={() => setMinimized(false)} className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-[8px] text-[12px] font-semibold text-white bg-brand-600 hover:bg-brand-500 cursor-pointer transition-colors">
              <Maximize2 size={13} aria-hidden="true" /> {done ? 'Open ATR' : 'Open'}
            </button>
          </div>
        </div>
        <ReportDiscardDialog
          open={confirmClose}
          title={CLOSE_CONFIRM_COPY[closeConfirmKind].title}
          body={CLOSE_CONFIRM_COPY[closeConfirmKind].body}
          confirmLabel={CLOSE_CONFIRM_COPY[closeConfirmKind].confirm}
          cancelLabel={CLOSE_CONFIRM_COPY[closeConfirmKind].cancel}
          onConfirm={() => { setConfirmClose(false); onClose?.(); }}
          onCancel={() => setConfirmClose(false)}
        />
      </FooterSlotContext.Provider>
    );
  }

  return (
    <FooterSlotContext.Provider value={footerEl}>
      <div className="relative flex flex-col h-full min-h-0">
        {/* Modal chrome — title + clickable step rail (mirrors the ATR-builder modal) */}
        <header className="shrink-0 px-6 pt-3.5 pb-3 border-b border-canvas-border print:hidden">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><CloudUpload size={16} /></div>
              <div>
                <h2 className="text-[0.9375rem] font-semibold text-ink-900 leading-tight">Generate ATR by Upload</h2>
                <p className="text-[0.75rem] text-ink-500 leading-snug">Pick a method, upload, validate, link annexures, then generate.</p>
              </div>
            </div>
            {onClose && (
              <button onClick={requestClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-draft-50 flex items-center justify-center cursor-pointer shrink-0" aria-label="Close"><X size={16} /></button>
            )}
          </div>
          <Stepper stage={state.stage} method={state.method} onJump={goTo} />
        </header>

        {/* Screen router. The summary step runs full-bleed — it owns its own
            padding so the rail + list span the modal edge-to-edge. */}
        <div className={`flex-1 min-h-0 ${state.stage === 'summary' ? 'overflow-hidden' : 'overflow-y-auto px-6 py-5'}`}>
          {state.stage === 'method' && <Step1MethodSelect onPick={pickMethod} />}
          {state.stage === 'template' && (
            <Step2aTemplateDownload onUpload={(file, annexures) => beginExtraction(file, 'template', annexures)} />
          )}
          {state.stage === 'upload' && (
            <Step2bReportUpload onExtract={(report, annexures, meta) => beginExtraction(report, 'report', annexures, meta)} />
          )}
          {state.stage === 'processing' && <Step3Processing progress={progress} step={step} />}
          {state.stage === 'summary' && <Step4ExtractionSummary onContinue={() => goTo('annexures')} />}
          {state.stage === 'annexures' && <Step5AnnexureMapping onContinue={() => goTo('preview')} />}
          {state.stage === 'decision' && <Step6Decision onGenerate={() => goTo('preview')} onManageExceptions={goToManageExceptionsAll} />}
          {state.stage === 'preview' && <Step7AtrPreview onManageExceptions={goToManageExceptions} onSaveAtr={onSaveAtr} />}
        </div>

        {/* Sticky footer — steps portal their primary action here. Hidden when empty. */}
        <footer ref={setFooterEl} className="shrink-0 empty:hidden print:hidden" />

        {/* Close guard — full-screen dialog over the upload model's own backdrop.
            The host hides its backdrop while this is open (onConfirmOpenChange)
            so there's a single uniform scrim. */}
        <ReportDiscardDialog
          open={confirmClose}
          title={CLOSE_CONFIRM_COPY[closeConfirmKind].title}
          body={CLOSE_CONFIRM_COPY[closeConfirmKind].body}
          confirmLabel={CLOSE_CONFIRM_COPY[closeConfirmKind].confirm}
          cancelLabel={CLOSE_CONFIRM_COPY[closeConfirmKind].cancel}
          onConfirm={() => { setConfirmClose(false); onClose?.(); }}
          onCancel={() => setConfirmClose(false)}
        />
      </div>
    </FooterSlotContext.Provider>
  );
}

/** The "Generate by Upload" tab — self-contained: owns its own provider so the
 *  wizard state persists independently of the rest of the reports module. */
export default function AtrUploadTab({ onClose, onManageExceptions, onSaveAtr, onConfirmOpenChange, onMinimizedChange }: {
  onClose?: () => void;
  onManageExceptions?: () => void;
  onSaveAtr?: (sessionId: string, label: string | undefined, data: AtrReportData) => string;
  onConfirmOpenChange?: (open: boolean) => void;
  onMinimizedChange?: (minimized: boolean) => void;
}) {
  return (
    <AtrUploadProvider>
      <AtrUploadInner onClose={onClose} onManageExceptions={onManageExceptions} onSaveAtr={onSaveAtr} onConfirmOpenChange={onConfirmOpenChange} onMinimizedChange={onMinimizedChange} />
    </AtrUploadProvider>
  );
}
