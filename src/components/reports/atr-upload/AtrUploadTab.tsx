import { useState, useEffect, useRef, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { Check, X, CloudUpload, Loader2, ArrowLeft } from 'lucide-react';
import { AtrUploadProvider, useAtrUpload } from './AtrUploadContext';
import { useAdminSettings } from './adminStore';
import { seedSession, seedEmptySession, PROCESSING_MESSAGES, PROCESSING_DURATION_MS } from './mockExtraction';
import { toAtrReportData } from './toAtrReportData';
import { useAuditLog } from '../../../context/AdminDataContext';
import { FooterSlotContext } from './footerSlot';
import { AtrModalHostContext, type AtrModalHost } from './atrModalHost';
import EscalationMatrixEditor from './components/EscalationMatrixEditor';
import type { WizardStage, UploadedFile, UploadMethod, ReportMeta } from './types';
import type { AtrReportData } from '../atrTypes';
import { stripExt } from './reportFields';
import type { EscalationMatrixConfig } from './escalationMatrix';
import Step1MethodSelect from './screens/Step1MethodSelect';
import Step2aTemplateDownload from './screens/Step2aTemplateDownload';
import Step2bReportUpload from './screens/Step2bReportUpload';
import ReportDetailView from './screens/ReportDetailView';
import Step3Processing from './screens/Step3Processing';
import { useToast } from '../../shared/Toast';

// ─── Stepper ───
// Create Report is a two-step journey for ONE report:
//   Step 1 · Upload — how to bring the report in (IRAME template vs. an existing
//            report) and the file(s), then Extract. The report details were
//            captured in the New Report modal before this opened.
//   Step 2 · Observations Extracted — this report's observations, to review and
//            edit, then Save as Draft or Generate ATR (both save into Reports).
// Earlier extractions are never listed here — a saved ATR reopens its own
// observations via "Edit observations" on the report.
const STEPS: { stage: WizardStage; label: string; hint: string }[] = [
  { stage: 'upload', label: 'Upload', hint: 'Choose the source and upload the file' },
  { stage: 'summary', label: 'Observations Extracted', hint: 'Review the observations, then save or generate' },
];
// 'processing' has no step of its own — it's surfaced as a corner toast (see
// Step3Processing) and the stepper sits on step 2 while it runs. The legacy
// 'method' / 'template' / 'dashboard' / 'admin' stages resolve to step 1 and
// 'annexures' / 'decision' / 'preview' to step 2.
const STAGE_INDEX: Record<WizardStage, number> = {
  dashboard: 0, method: 0, admin: 0, template: 0, upload: 0, processing: 1, summary: 1, annexures: 1, decision: 1, preview: 1,
};

// Header stepper. Step 2 unlocks once this report is extracted; processing
// locks navigation (the run is surfaced as a toast).
function Stepper({ stage, hasReport, onSelect }: {
  stage: WizardStage;
  hasReport: boolean;
  onSelect: (i: number) => void;
}) {
  const active = STAGE_INDEX[stage];
  const locked = stage === 'processing';
  const enabled = [true, hasReport].map(e => e && !locked);
  return (
    <ol role="tablist" aria-label="Create Report steps" className="flex items-center gap-3">
      {STEPS.map((st, i) => {
        const isActive = active === i;
        const done = i < active;
        const isEnabled = enabled[i];
        return (
          <li key={st.stage} className="flex items-center gap-3">
            {i > 0 && <span className={`h-px w-8 ${done || isActive ? 'bg-brand-300' : 'bg-canvas-border'}`} aria-hidden="true" />}
            <button
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-disabled={!isEnabled}
              disabled={!isEnabled}
              title={isEnabled ? st.hint : 'Extract the report to unlock'}
              onClick={() => isEnabled && onSelect(i)}
              className={`inline-flex items-center gap-2 h-8 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30 ${isEnabled && !isActive ? 'cursor-pointer' : isEnabled ? 'cursor-default' : 'cursor-not-allowed'}`}
            >
              <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-[0.6875rem] font-semibold tabular-nums shrink-0 border ${
                isActive ? 'bg-brand-600 border-brand-600 text-white' : done ? 'bg-canvas-elevated border-brand-300 text-brand-700' : 'bg-canvas-elevated border-canvas-border text-ink-400'
              }`}>
                {done ? <Check size={12} aria-hidden="true" /> : i + 1}
              </span>
              <span className={`text-[0.8125rem] whitespace-nowrap ${isActive ? 'font-semibold text-ink-900' : done ? 'font-medium text-ink-700 hover:text-ink-900' : 'font-medium text-ink-400'}`}>{st.label}</span>
            </button>
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

export interface AtrUploadTabProps {
  onClose?: () => void;
  /** Fires when the wizard minimizes to / restores from the floating toast, so the
   *  host can drop the backdrop and shrink the container (non-blocking extraction). */
  onMinimizedChange?: (minimized: boolean) => void;
  /** Generate ATR (or View report on an already-generated one): the host saves
   *  the ATR into the Reports module — keyed by `sessionId` so it's one card per
   *  report — then closes this wizard and opens the saved report. */
  onGenerated: (sessionId: string, data: AtrReportData, opts?: { regenerate?: boolean; draft?: boolean }) => void;
  /** The report details captured in the New Report modal (name, classification,
   *  cover facts). They print on the ATR cover, so the upload step does not ask
   *  for them again; `reportName` names the extracted report and its ATR. */
  initialMeta?: Partial<ReportMeta>;
  /** Back to the New Report modal (the details step) — shown on the Upload tab. */
  onBack?: () => void;
  /** Open straight on this extracted report's observations (Observations
   *  Extracted → detail) — "Edit observations" from a generated ATR. */
  initialSessionId?: string;
}

function AtrUploadInner({ onClose, onMinimizedChange, onGenerated, initialMeta, onBack, initialSessionId }: AtrUploadTabProps) {
  const { state, setMethod, addSession, selectSession, updateSession, goTo } = useAtrUpload();
  // The org-wide default escalation matrix (configured in Reports → Admin) is
  // applied to every newly-extracted report. `addLog` records each change to the
  // Transaction Logs (Reports → Admin).
  const { escalation: adminEscalation, addLog } = useAdminSettings();
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  // The sticky footer DOM node — steps portal their primary CTA into it.
  const [footerEl, setFooterEl] = useState<HTMLElement | null>(null);
  // The one report this visit is about — the session extracted here, or the
  // one "Edit observations" opened. Step 2 shows only this report; earlier
  // extractions are never listed.
  const [visitSessionId, setVisitSessionId] = useState<string | null>(initialSessionId ?? null);

  // On open, the combined first step ALWAYS starts with no method selected — the
  // user must pick, then the matching details render below. A method persisted
  // from a prior visit is a stale pre-selection, not progress (a real in-flight
  // session resumes at a later stage, never the first step), so clear it on mount.
  const didInitMethod = useRef(false);
  useEffect(() => {
    if (didInitMethod.current) return;
    didInitMethod.current = true;
    // Opened from a generated ATR: land directly on that report's observations.
    if (initialSessionId && state.sessions.some(s => s.id === initialSessionId)) {
      selectSession(initialSessionId);
      goTo('summary');
      return;
    }
    // Otherwise always (re)open on the Upload tab with a clean method picker —
    // the extracted reports / ATRs still persist, we just never resume on a
    // later tab.
    setMethod(null);
    goTo('upload');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escalation-matrix editor swap: the card asks the host to open it, and it
  // renders full-frame over the wizard (no nested modal) while the wizard stays
  // mounted underneath so all step state is preserved.
  const [escEditor, setEscEditor] = useState<{ config: EscalationMatrixConfig; onChange: (c: EscalationMatrixConfig) => void } | null>(null);
  const modalHost = useMemo<AtrModalHost>(() => ({
    openEscalationEditor: (config, onChange) => setEscEditor({ config, onChange }),
  }), []);

  // Extraction runs HERE (not in Step3Processing) so it keeps advancing while the
  // wizard is minimized to a floating toast. Progress/step drive both the full
  // processing screen and the toast.
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(0);
  // Extraction runs as a floating toast card so the user can keep working on the
  // platform. The card has no "Open" CTA — the whole card is clickable to reopen.
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
    // On completion, open the just-extracted report's detail and restore the
    // wizard so the user lands straight on it.
    const done = window.setTimeout(() => {
      setMinimized(false);
      goToRef.current('summary');
    }, PROCESSING_DURATION_MS);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(done); };
  }, [state.stage]);

  // Going back to Reports never discards: the whole wizard (reports, ATRs, edits)
  // auto-persists to localStorage, so we just close and everything resumes on the
  // next visit — no confirmation prompt.
  const requestClose = () => { onClose?.(); };

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
    // The report details come from the New Report modal (`initialMeta`); a step
    // may still add to them. The Report Name names the extracted report and its
    // ATR — fall back to the file name (sans extension) if it somehow arrives blank.
    const merged: Partial<ReportMeta> = { ...(initialMeta ?? {}), ...(meta ?? {}) };
    const reportName = merged.reportName?.trim() || stripExt(file.name);
    const metaWithName: Partial<ReportMeta> = { ...merged, reportName };
    // The escalation cadence comes from the Admin default, not per-upload.
    const escalation = adminEscalation;
    const empty = /empty|blank/.test(name);
    const session = empty
      ? seedEmptySession(toUploadedFile(file), method, metaWithName, escalation)
      : seedSession(toUploadedFile(file), method, annexures.map(toUploadedFile), metaWithName, escalation);
    addSession(session);
    setVisitSessionId(session.id);
    const obsN = session.observations.length;
    logEvent({
      action: 'Create',
      description: `Uploaded "${file.name}" and extracted ${obsN} observation${obsN === 1 ? '' : 's'} for an ATR`,
      module: 'Reports',
      entity: 'ATR Extraction',
    });
    addLog({ action: 'Extract', target: reportName, detail: `Extracted ${obsN} observation${obsN === 1 ? '' : 's'} from "${file.name}"` });
    // Minimise to the floating toast so extraction runs in the background and the
    // user can keep working on the platform.
    setMinimized(true);
    goTo('processing');
  };

  // Stepper navigation. Steps are gated in <Stepper/>; here we just route.
  const onStepSelect = (i: number) => goTo(i === 0 ? 'upload' : 'summary');

  // Generate the ATR for the active report — snapshot it, stamp `generatedAt`
  // (so the report's CTA flips to "View report" and the dashboard counts it),
  // then hand it to the Reports module, which saves it and opens it.
  const generateAtr = () => {
    if (!state.session) return;
    const session = state.session;
    const first = !session.generatedAt;
    const label = session.meta.reportName?.trim() || session.meta.auditTitle?.trim() || session.file?.filename || 'Report';
    const data = session.atrDraft ?? toAtrReportData(session);
    // Commit the stamp synchronously: `onGenerated` makes the host switch to the
    // saved report, which unmounts this wizard (and its provider) in the same
    // click — a merely-queued update would be dropped before it ever persisted.
    flushSync(() => {
      updateSession(s => ({ ...s, generatedAt: s.generatedAt ?? new Date().toISOString(), atrDraft: s.atrDraft ?? data }));
    });
    if (first) {
      logEvent({ action: 'Create', description: `Generated an ATR from the uploaded report "${session.file?.filename ?? ''}"`, module: 'Reports', entity: 'Action Taken Report' });
      addLog({ action: 'Generate', target: label, detail: 'Generated the Action Taken Report and saved it in Reports' });
    }
    onGenerated(session.id, data);
  };
  // Save as Draft — the report is saved into Reports as a draft ATR (same card
  // the final ATR will take over), so the work is kept without issuing it.
  const saveDraft = () => {
    if (!state.session) return;
    const session = state.session;
    const label = session.meta.reportName?.trim() || session.meta.auditTitle?.trim() || session.file?.filename || 'Report';
    const data = toAtrReportData(session);
    flushSync(() => {
      updateSession(s => ({ ...s, draftSavedAt: new Date().toISOString(), atrDraft: s.generatedAt ? s.atrDraft : data }));
    });
    logEvent({ action: 'Create', description: `Saved "${label}" as a draft Action Taken Report`, module: 'Reports', entity: 'Action Taken Report' });
    addLog({ action: 'Generate', target: label, detail: 'Saved as a draft Action Taken Report in Reports' });
    onGenerated(session.id, data, { draft: true });
  };
  // Regenerate the ATR from the observations as they now stand — the saved
  // report is refreshed in place (same card), with its case links carried over.
  const regenerateAtr = () => {
    if (!state.session) return;
    const session = state.session;
    const label = session.meta.reportName?.trim() || session.meta.auditTitle?.trim() || session.file?.filename || 'Report';
    const data = toAtrReportData(session);
    flushSync(() => {
      updateSession(s => ({ ...s, generatedAt: s.generatedAt ?? new Date().toISOString(), atrDraft: data }));
    });
    logEvent({ action: 'Update', description: `Regenerated the ATR "${label}" from its edited observations`, module: 'Reports', entity: 'Action Taken Report' });
    addLog({ action: 'Generate', target: label, detail: 'Regenerated the Action Taken Report from the edited observations' });
    onGenerated(session.id, data, { regenerate: true });
  };
  // Open the already-generated report for the active session (saved in Reports).
  const viewAtr = () => {
    if (!state.session) return;
    onGenerated(state.session.id, state.session.atrDraft ?? toAtrReportData(state.session));
  };

  // Picking a method stays on the Upload tab — the matching upload form is
  // revealed directly below the cards (no separate Select step).
  const pickMethod = (method: UploadMethod) => { setMethod(method); goTo('upload'); };
  const onUploadStage = state.stage === 'upload' || state.stage === 'template' || state.stage === 'method' || state.stage === 'dashboard' || state.stage === 'admin';
  const reportLabel = initialMeta?.reportName?.trim();

  // Observations-Extracted stages (summary + the legacy annexures/decision/
  // preview) render the report list, or — once a report is opened — its detail.
  const onReportStage = state.stage === 'summary' || state.stage === 'annexures' || state.stage === 'decision' || state.stage === 'preview';
  // Step 2 is only ever this visit's report.
  const hasReport = !!state.session && !!visitSessionId && state.session.id === visitSessionId;
  const summaryDetail = onReportStage && hasReport;

  if (minimized) {
    const done = state.stage !== 'processing';
    const obsCount = state.session?.observations.length ?? 0;
    return (
      <FooterSlotContext.Provider value={footerEl}>
        {/* The whole card reopens the wizard (no explicit Open CTA). */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setMinimized(false)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMinimized(false); } }}
          title="Click to reopen"
          className="p-4 cursor-pointer group"
        >
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
              {done ? <Check size={16} aria-hidden="true" /> : <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[0.8125rem] font-semibold text-ink-900 leading-tight">{done ? 'Extraction complete' : 'Extracting your report'}</div>
              <div className="text-[0.71875rem] text-ink-500 truncate mt-0.5">{done ? `${obsCount} observation${obsCount === 1 ? '' : 's'} ready` : PROCESSING_MESSAGES[step]}</div>
            </div>
            {!done && <span className="text-[0.8125rem] font-bold tabular-nums text-brand-700 shrink-0">{Math.round(progress)}%</span>}
            <button onClick={e => { e.stopPropagation(); requestClose(); }} className="w-7 h-7 rounded-full text-ink-400 hover:text-ink-800 hover:bg-draft-50 flex items-center justify-center cursor-pointer shrink-0" aria-label="Close"><X size={14} /></button>
          </div>
          {!done && (
            <div className="mt-3 h-1.5 rounded-full bg-brand-50 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-500 transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          )}
          <div className="mt-3">
            <span className="text-[0.6875rem] text-ink-400">{done ? 'Click to reopen and review.' : 'Running in the background — keep working on the platform.'}</span>
          </div>
        </div>
      </FooterSlotContext.Provider>
    );
  }

  return (
    <AtrModalHostContext.Provider value={modalHost}>
    <FooterSlotContext.Provider value={footerEl}>
      <div className="relative flex flex-col h-full min-h-0">
        {/* Modal chrome — title + close, then the tab bar. */}
        <header className="shrink-0 px-6 pt-4 pb-3 border-b border-canvas-border print:hidden">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><CloudUpload size={16} /></div>
              <div>
                <h2 className="text-[1.0625rem] font-semibold text-ink-900 leading-tight tracking-tight">{reportLabel ? <>Create Report · <span className="text-brand-700">{reportLabel}</span></> : 'Create Report'}</h2>
                <p className="text-[0.75rem] text-ink-500 leading-snug mt-0.5">Upload the source report, review its observations &amp; annexures, then generate the Action Taken Report — it saves to Reports.</p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {onBack && onUploadStage && (
                <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[0.75rem] font-medium text-ink-600 hover:text-brand-700 hover:bg-canvas transition-colors cursor-pointer" title="Back to the report details">
                  <ArrowLeft size={14} aria-hidden="true" /> Back
                </button>
              )}
              {onClose && (
                <button onClick={requestClose} className="w-8 h-8 rounded-md text-ink-500 hover:text-ink-800 hover:bg-canvas flex items-center justify-center cursor-pointer shrink-0" aria-label="Close"><X size={18} /></button>
              )}
            </div>
          </div>
          <Stepper
            stage={state.stage}
            hasReport={hasReport}
            onSelect={onStepSelect}
          />
        </header>

        {/* Screen router. Step 2 (this report's observations) runs full-bleed —
            it owns its own padding; step 1 scrolls in the normal padded frame. */}
        <div className={`flex-1 min-h-0 ${summaryDetail ? 'overflow-hidden' : 'overflow-y-auto px-6 py-5'}`}>
          {/* Upload — pick how to bring a report in; the chosen method's upload
              form is revealed directly below the cards (the legacy 'method' /
              'template' / 'dashboard' / 'admin' stages land here too). */}
          {(onUploadStage || (onReportStage && !hasReport)) && (
            <div className="space-y-6">
              <Step1MethodSelect onPick={pickMethod} selected={state.method} compact={!!state.method} />
              {state.method && (
                <div className="pt-6 border-t border-canvas-border">
                  {state.method === 'template'
                    ? <Step2aTemplateDownload onUpload={(file, annexures) => beginExtraction(file, 'template', annexures)} />
                    : <Step2bReportUpload onExtract={(report, annexures) => beginExtraction(report, 'report', annexures)} />}
                </div>
              )}
            </div>
          )}
          {state.stage === 'processing' && <Step3Processing progress={progress} step={step} />}
          {summaryDetail && (
            <ReportDetailView onGenerate={generateAtr} onViewAtr={viewAtr} onRegenerate={regenerateAtr} onSaveDraft={saveDraft} />
          )}
        </div>

        {/* Sticky footer — steps portal their primary action here. Hidden when empty. */}
        <footer ref={setFooterEl} className="shrink-0 empty:hidden print:hidden" />

        {/* Escalation Matrix editor — swaps in full-frame over the wizard (which
            stays mounted underneath, preserving all step state). */}
        {escEditor && (
          <div className="absolute inset-0 z-30 bg-canvas-elevated flex flex-col print:hidden">
            <EscalationMatrixEditor
              config={escEditor.config}
              onApply={next => { escEditor.onChange(next); setEscEditor(null); }}
              onCancel={() => setEscEditor(null)}
            />
          </div>
        )}
      </div>
    </FooterSlotContext.Provider>
    </AtrModalHostContext.Provider>
  );
}

/** The "Create Report" wizard — owns its own provider so the wizard state
 *  persists independently of the rest of the reports module. Admin settings
 *  (LOVs, escalation matrix, transaction logs) come from the host's
 *  `AdminSettingsProvider`, shared with the Reports → Admin tab. */
export default function AtrUploadTab(props: AtrUploadTabProps) {
  return (
    <AtrUploadProvider>
      <AtrUploadInner {...props} />
    </AtrUploadProvider>
  );
}
