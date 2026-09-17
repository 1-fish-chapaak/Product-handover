import { useState, useEffect, useRef, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { Check, X, CloudUpload, Loader2 } from 'lucide-react';
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
import ReportsExtractedList from './screens/ReportsExtractedList';
import ReportDetailView from './screens/ReportDetailView';
import Step3Processing from './screens/Step3Processing';
import { useToast } from '../../shared/Toast';

// ─── Tabs ───
// The wizard reads as three tabs, in the order the work happens:
//   Select  — how to bring a report in (IRAME template vs. an existing report)
//   Upload  — the chosen method's file(s) + the report details, then Extract
//   Observations Extracted — every report extracted this visit; open one to
//                            review its observations
// Generated ATRs are saved into the Reports module (My Reports) and open there,
// so there is no Action Taken Report tab; Admin lives in the Reports module too.
const TABS: { stage: WizardStage; label: string }[] = [
  { stage: 'method', label: 'Select' },
  { stage: 'upload', label: 'Upload' },
  { stage: 'summary', label: 'Observations Extracted' },
];
// 'processing' has no tab of its own — it's surfaced as a corner toast (see
// Step3Processing) and the bar sits on "Observations Extracted" while it runs.
// Annexures are managed inside the opened report (no separate tab); the legacy
// 'annexures' / 'decision' / 'preview' stages map to the same slot, 'template'
// is the Upload tab, and the legacy 'dashboard' / 'admin' stages resolve to Select.
const STAGE_INDEX: Record<WizardStage, number> = {
  dashboard: 0, method: 0, admin: 0, template: 1, upload: 1, processing: 2, summary: 2, annexures: 2, decision: 2, preview: 2,
};

const TAB_TIP: Record<string, string> = {
  method: 'Choose how to bring a report in',
  upload: 'Upload the file and fill in the report details',
  summary: 'The observations you’ve extracted — open a report to review them',
};

// Header tab bar. "Upload" unlocks once a method is selected; "Observations
// Extracted" once a report is extracted. Processing locks all navigation (the
// run is surfaced as a toast).
function Tabs({ stage, sessionCount, hasMethod, onSelect }: {
  stage: WizardStage;
  sessionCount: number;
  hasMethod: boolean;
  onSelect: (i: number) => void;
}) {
  const active = STAGE_INDEX[stage];
  const locked = stage === 'processing';
  const enabled = [true, hasMethod, sessionCount > 0].map(e => e && !locked);
  return (
    <div role="tablist" aria-label="ATR generation steps" className="flex items-center gap-1 -mb-px overflow-x-auto">
      {TABS.map((t, i) => {
        const isActive = active === i;
        const isEnabled = enabled[i];
        const tip = isEnabled ? TAB_TIP[t.stage] : i === 1 ? 'Pick a method on Select to unlock' : 'Extract a report to unlock';
        return (
          <button
            key={t.stage}
            type="button"
            role="tab"
            title={tip}
            aria-selected={isActive}
            aria-disabled={!isEnabled}
            disabled={!isEnabled}
            onClick={() => isEnabled && onSelect(i)}
            className={`relative inline-flex items-center gap-1.5 h-9 px-3.5 text-[0.8125rem] font-semibold whitespace-nowrap border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30 rounded-t-sm ${
              isActive
                ? 'border-brand-600 text-brand-700'
                : isEnabled
                  ? 'border-transparent text-ink-500 hover:text-ink-900 hover:border-canvas-border cursor-pointer'
                  : 'border-transparent text-ink-300 cursor-not-allowed'
            }`}
          >
            {t.label}
            {i === 2 && sessionCount > 0 && (
              <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[0.625rem] font-bold tabular-nums ${isActive ? 'bg-brand-600 text-white' : 'bg-paper-100 text-ink-500'}`}>{sessionCount}</span>
            )}
          </button>
        );
      })}
    </div>
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
  onGenerated: (sessionId: string, data: AtrReportData) => void;
}

function AtrUploadInner({ onClose, onMinimizedChange, onGenerated }: AtrUploadTabProps) {
  const { state, setMethod, addSession, selectSession, removeSession, updateSession, goTo } = useAtrUpload();
  // The org-wide default escalation matrix (configured in Reports → Admin) is
  // applied to every newly-extracted report. `addLog` records each change to the
  // Transaction Logs (Reports → Admin).
  const { escalation: adminEscalation, addLog } = useAdminSettings();
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  // The sticky footer DOM node — steps portal their primary CTA into it.
  const [footerEl, setFooterEl] = useState<HTMLElement | null>(null);
  // On the "Observations Extracted" tab: false → the list of extracted reports;
  // true → the opened report's detail. Opening a row sets it true.
  const [reportDetailOpen, setReportDetailOpen] = useState(false);

  // On open, the combined first step ALWAYS starts with no method selected — the
  // user must pick, then the matching details render below. A method persisted
  // from a prior visit is a stale pre-selection, not progress (a real in-flight
  // session resumes at a later stage, never the first step), so clear it on mount.
  const didInitMethod = useRef(false);
  useEffect(() => {
    if (didInitMethod.current) return;
    didInitMethod.current = true;
    // Always (re)open on the Upload tab with a clean method picker — the extracted
    // reports / ATRs still persist, we just never resume on a later tab.
    setMethod(null);
    goTo('method');
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
      setReportDetailOpen(true);
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
    // The Report Name names the extracted report and its ATR. The form pre-fills
    // it from the uploaded file (sans extension) and the user may rename it; fall
    // back to the file name if it somehow arrives blank.
    const reportName = meta?.reportName?.trim() || stripExt(file.name);
    const metaWithName: Partial<ReportMeta> = { ...(meta ?? {}), reportName };
    // The escalation cadence comes from the Admin default, not per-upload.
    const escalation = adminEscalation;
    const empty = /empty|blank/.test(name);
    const session = empty
      ? seedEmptySession(toUploadedFile(file), method, metaWithName, escalation)
      : seedSession(toUploadedFile(file), method, annexures.map(toUploadedFile), metaWithName, escalation);
    addSession(session);
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
    setReportDetailOpen(false);
    setMinimized(true);
    goTo('processing');
  };

  // Open one extracted report's detail (observations + cover facts) from the list.
  const openReport = (id: string) => { selectSession(id); setReportDetailOpen(true); };
  // Remove a report from the list; if it was the last one, fall back to Upload so
  // the bar doesn't rest on a now-empty "Observations Extracted" tab. An ATR
  // already generated from it stays in Reports — it's a saved report by then.
  const handleRemoveReport = (id: string) => {
    const s = state.sessions.find(x => x.id === id);
    const label = s?.meta.reportName?.trim() || s?.meta.auditTitle?.trim() || s?.file?.filename || 'Report';
    removeSession(id);
    setReportDetailOpen(false);
    addLog({ action: 'Remove', target: label, detail: 'Removed the extracted report and its observations' });
    if (state.sessions.length <= 1) goTo('method');
  };
  // Start another upload — a clean method picker, staying in a single wizard.
  const uploadAnother = () => { setMethod(null); setReportDetailOpen(false); goTo('method'); };

  // Header tab navigation. Tabs are gated in <Tabs/>; here we just route + set
  // the Observations-Extracted sub-view (always land on the list, never mid-detail).
  const onTabSelect = (i: number) => {
    setReportDetailOpen(false);
    if (i === 0) goTo('method');
    else if (i === 1) { if (state.method) goTo('upload'); }
    else goTo('summary');
  };

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
  // Open the already-generated report for the active session (saved in Reports).
  const viewAtr = () => {
    if (!state.session) return;
    onGenerated(state.session.id, state.session.atrDraft ?? toAtrReportData(state.session));
  };

  // Picking a method stays on the combined first step — the matching upload form
  // is revealed directly below (no separate Upload stage).
  // Picking a method on Select moves straight on to Upload.
  const pickMethod = (method: UploadMethod) => { setMethod(method); goTo('upload'); };

  // Observations-Extracted stages (summary + the legacy annexures/decision/
  // preview) render the report list, or — once a report is opened — its detail.
  const onReportStage = state.stage === 'summary' || state.stage === 'annexures' || state.stage === 'decision' || state.stage === 'preview';
  const summaryDetail = onReportStage && reportDetailOpen && !!state.session;

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
                <h2 className="text-[1.0625rem] font-semibold text-ink-900 leading-tight tracking-tight">Create Report</h2>
                <p className="text-[0.75rem] text-ink-500 leading-snug mt-0.5">Upload a report, review its observations &amp; annexures, then generate the Action Taken Report — it saves to Reports.</p>
              </div>
            </div>
            {onClose && (
              <button onClick={requestClose} className="w-8 h-8 rounded-md text-ink-500 hover:text-ink-800 hover:bg-canvas flex items-center justify-center cursor-pointer shrink-0" aria-label="Close"><X size={18} /></button>
            )}
          </div>
          <Tabs
            stage={state.stage}
            sessionCount={state.sessions.length}
            hasMethod={!!state.method}
            onSelect={onTabSelect}
          />
        </header>

        {/* Screen router. The opened report's DETAIL runs full-bleed — it owns
            its own padding so the rail + list span the modal edge-to-edge; the
            Observations-Extracted list scrolls in the normal padded frame. */}
        <div className={`flex-1 min-h-0 ${summaryDetail ? 'overflow-hidden' : 'overflow-y-auto px-6 py-5'}`}>
          {/* Step 1 · Select — how to bring a report in. Picking a card moves on
              to Upload (the legacy 'dashboard' / 'admin' stages land here too). */}
          {(state.stage === 'method' || state.stage === 'dashboard' || state.stage === 'admin') && (
            <Step1MethodSelect onPick={pickMethod} selected={state.method} />
          )}
          {/* Step 2 · Upload — the chosen method's upload form + report details
              (switch method via the Select tab). Without a method (stale
              deep-link) it falls back to Select. */}
          {(state.stage === 'upload' || state.stage === 'template') && (
            !state.method ? <Step1MethodSelect onPick={pickMethod} selected={state.method} /> : (
              state.method === 'template'
                ? <Step2aTemplateDownload onUpload={(file, annexures, meta) => beginExtraction(file, 'template', annexures, meta)} />
                : <Step2bReportUpload onExtract={(report, annexures, meta) => beginExtraction(report, 'report', annexures, meta)} />
            )
          )}
          {state.stage === 'processing' && <Step3Processing progress={progress} step={step} />}
          {onReportStage && (
            summaryDetail
              ? <ReportDetailView onBack={() => setReportDetailOpen(false)} onGenerate={generateAtr} onViewAtr={viewAtr} />
              : (
                <ReportsExtractedList
                  sessions={state.sessions}
                  activeId={state.activeSessionId}
                  onOpen={openReport}
                  onRemove={handleRemoveReport}
                  onUploadAnother={uploadAnother}
                />
              )
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
