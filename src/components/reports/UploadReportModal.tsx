import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  X, FileText, FileSpreadsheet, Loader2, CheckCircle2, Sparkles,
  ArrowRight, ArrowLeft, Check, Download, ChevronDown, Lock, Save, FilePenLine,
  Upload, UploadCloud, LayoutTemplate, Paperclip, ListChecks, AlertTriangle, FileCheck2,
  PencilLine, Briefcase, Image as ImageIcon, Palette, Calendar, RefreshCw, SlidersHorizontal,
} from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useToast } from '../shared/Toast';
import { Button } from '../shared/Button';
import UploadDataModal from '../concierge-workflow-builder/UploadDataModal';
import AtrDocument from './AtrDocument';
import AtrItemsEditor from './AtrItemsEditor';
import AtrValidationStep from './AtrValidationStep';
import AtrAnnexureStep from './AtrAnnexureStep';
import {
  REQUIRED_FIELDS, downloadExcelTemplate, downloadWordTemplate, parseObservationsFromFile,
  exportAtrExcel, exportAtrWord, SAMPLE_OBSERVATIONS, SAMPLE_INSIGHTS,
} from './atrTemplate';
import {
  type AtrWorkObs, type AtrAnnexure, toWorkObs, toAtrObservations,
  parseAnnexureFiles, extractEmbeddedAnnexures, ANNEXURE_POOL, unresolvedCount, selectedCount, totalExceptionRows,
  ENGAGEMENT_SOURCES, regenerateInsights,
} from './atrBuilder';
import { saveAtrDraft } from './atrDraft';
import type { AtrMeta, AtrObservation, AtrInsight, AtrReportData } from './atrTypes';
import { PEOPLE } from '../../data/grc-domain';

// Status rollup for an observation set — 'Closed' surfaces as "Complete".
function statusBreakdown(obs: AtrObservation[]) {
  const out = { Complete: 0, 'In Progress': 0, Open: 0, Overdue: 0 } as Record<string, number>;
  obs.forEach(o => {
    const s = o.status === 'Closed' ? 'Complete' : (o.status ?? 'Open');
    if (s in out) out[s]++;
  });
  return out;
}


const PROCESS_MESSAGES = ['Reading your report…', 'Identifying observations…', 'Extracting annexures…', 'Almost there…'];

type StartMode = 'template' | 'upload' | 'manual' | 'engagement';

type Stage =
  | 'entry' | 'template-upload' | 'report-upload' | 'engagement-pick' | 'manual-edit'
  | 'processing' | 'validation' | 'annexures' | 'decision' | 'customize' | 'preview';

const STEPPER: { key: string; label: string; stages: Stage[] }[] = [
  { key: 'start', label: 'Start', stages: ['entry', 'template-upload', 'report-upload', 'engagement-pick', 'processing'] },
  { key: 'validate', label: 'Validate', stages: ['validation', 'manual-edit'] },
  { key: 'annexures', label: 'Annexures', stages: ['annexures'] },
  { key: 'generate', label: 'Generate', stages: ['decision', 'customize', 'preview'] },
];

const STEP_TIP: Record<string, string> = {
  start: 'Choose your input source — template, upload, manual, or engagement',
  validate: 'Review and select the extracted observations',
  annexures: 'Link exception annexures to observations',
  generate: 'Customize branding and generate the ATR',
};

const THEME_PRESETS: { name: string; color: string }[] = [
  { name: 'Purple', color: '#6a12cd' },
  { name: 'Indigo', color: '#3949ab' },
  { name: 'Teal', color: '#0f766e' },
  { name: 'Slate', color: '#334155' },
];

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}
function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
}

/**
 * ATR Builder — the full guided journey:
 *   Stage 0  Entry         — IRAME template vs upload existing report
 *   Stage 1A Template       — pick format, download, upload the filled template
 *   Stage 1B Upload         — upload report (+ optional annexures)
 *   Stage 2  Validation     — extraction summary, selection, missing-field resolve
 *   Stage 3  Annexures       — confirm observation → annexure mapping
 *   Stage 4  Decision        — Generate ATR vs Manage Exceptions first
 *   Stage 5A Preview         — editable ATR + Download / Save / Finalize
 */
export default function UploadReportModal({ onClose, onAddToReport, onFreeze, onManageExceptions, resumeDraft }: {
  onClose: () => void;
  onAddToReport?: (meta: AtrMeta, observations: AtrObservation[], insights: AtrInsight[]) => void;
  onFreeze?: (meta: AtrMeta, observations: AtrObservation[], insights: AtrInsight[]) => void;
  /** Stage 4 — "Manage Exceptions first" hands off to the case-management view. */
  onManageExceptions?: () => void;
  /** When returning from Manage Exceptions, resume the parked ATR at the preview. */
  resumeDraft?: AtrReportData | null;
}) {
  const { addToast } = useToast();
  const [stage, setStage] = useState<Stage>(resumeDraft ? 'preview' : 'entry');
  const [startMode, setStartMode] = useState<StartMode>('template');
  const [reportFiles, setReportFiles] = useState<File[]>([]);
  const [annexFiles, setAnnexFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState(false);
  // Shared "Add data" upload modal — one for the main file (template/report),
  // one for annexures. The main accept-list is derived from the active stage.
  const [mainUploadOpen, setMainUploadOpen] = useState(false);
  const [annexUploadOpen, setAnnexUploadOpen] = useState(false);
  // Session-only: each fresh modal open starts with nothing downloaded, so the
  // rows show "Download" (not a stale "Downloaded" from a previous session).
  const [downloadedTmpls, setDownloadedTmpls] = useState<Set<string>>(() => new Set<string>());
  const markDownloaded = (k: string) => setDownloadedTmpls(prev => new Set(prev).add(k));
  const [confirmClose, setConfirmClose] = useState(false);
  const [procMsg, setProcMsg] = useState(0);
  // Stage 4 (decision): which path the user has selected. Cards select; the
  // footer primary button executes — same select→advance pattern as Steps 1–3.
  const [decisionChoice, setDecisionChoice] = useState<'generate' | 'manage'>('generate');

  const [workObs, setWorkObs] = useState<AtrWorkObs[]>(() => resumeDraft ? toWorkObs(resumeDraft.observations) : []);
  const [manualObs, setManualObs] = useState<AtrObservation[]>([{ title: '', description: '', risk: 'Medium', status: 'Open', actionPlans: [{ text: '' }] }]);
  const [annexurePool, setAnnexurePool] = useState<AtrAnnexure[]>(ANNEXURE_POOL);
  const [embeddedAnnex, setEmbeddedAnnex] = useState<AtrAnnexure[]>([]);
  const [insights, setInsights] = useState<AtrInsight[]>(() => resumeDraft?.insights ?? []);
  const [previewObs, setPreviewObs] = useState<AtrObservation[]>(() => resumeDraft?.observations ?? []);
  const [previewEditing, setPreviewEditing] = useState(false);
  const [showFormats, setShowFormats] = useState(false);

  // Report metadata / customization (Stage: Customize). Restored from a parked draft.
  const rm = resumeDraft?.meta;
  const [auditTitle, setAuditTitle] = useState(rm?.auditTitle ?? '');
  const [auditPeriod, setAuditPeriod] = useState(rm?.auditPeriod ?? '');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [preparedBy, setPreparedBy] = useState(rm?.preparedBy ?? 'Internal Audit Team');
  const [reviewedBy, setReviewedBy] = useState(rm?.reviewedBy ?? '');
  const [auditEntity, setAuditEntity] = useState(rm?.auditEntity ?? 'Acme Corp — Internal Audit');
  const [brandColor, setBrandColor] = useState<string>(rm?.brandColor ?? '');
  const [hexDraft, setHexDraft] = useState<string>(rm?.brandColor ?? '');
  const [reviewerOpen, setReviewerOpen] = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState<string>(rm?.logoDataUrl ?? '');
  const pickBrand = (c: string) => { setBrandColor(c); setHexDraft(c); };
  const onHexChange = (v: string) => {
    let s = v.trim(); if (s && !s.startsWith('#')) s = '#' + s;
    setHexDraft(s);
    if (/^#[0-9a-fA-F]{6}$/.test(s)) setBrandColor(s);
    else if (s === '' || s === '#') setBrandColor('');
  };
  const reviewerMatches = PEOPLE.filter(p => p.name.toLowerCase().includes(reviewedBy.trim().toLowerCase()));
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  // PDF export options.
  const [pdfOrientation, setPdfOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [pdfFontScale, setPdfFontScale] = useState<number>(100);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Closing with work-in-progress prompts a discard confirmation.
  const isDirty = stage !== 'entry' && (workObs.length > 0 || reportFiles.length > 0 || previewObs.length > 0);
  const requestClose = () => { if (isDirty) setConfirmClose(true); else onClose(); };
  useFocusTrap(containerRef, stage !== 'processing', requestClose);

  const { reportId, generatedOn } = useMemo(() => {
    const now = new Date();
    const q = Math.floor(now.getMonth() / 3) + 1;
    return {
      reportId: `ATR-${now.getFullYear()}-Q${q}-001`,
      generatedOn: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    };
  }, []);

  // Cycle the processing status messages (procMsg is reset at the transition).
  useEffect(() => {
    if (stage !== 'processing') return;
    const t = setInterval(() => setProcMsg(m => Math.min(m + 1, PROCESS_MESSAGES.length - 1)), 540);
    return () => clearInterval(t);
  }, [stage]);


  const meta: AtrMeta = {
    reportId,
    auditTitle: auditTitle || 'Action Taken Report',
    auditPeriod: auditPeriod || `Q${Math.floor(new Date().getMonth() / 3) + 1} FY ${new Date().getFullYear()}`,
    preparedBy: preparedBy || 'Internal Audit Team',
    reviewedBy: reviewedBy || undefined,
    generatedOn,
    auditEntity: auditEntity || undefined,
    brandColor: brandColor || undefined,
    logoDataUrl: logoDataUrl || undefined,
  };

  const onLogoPick = (f?: File) => {
    if (!f) return;
    if (!/^image\//.test(f.type)) { addToast({ type: 'error', message: 'Logo must be an image (PNG/JPG/SVG).' }); return; }
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(String(reader.result));
    reader.readAsDataURL(f);
  };

  // Accepted extensions for the main upload, by stage (template vs report).
  const mainAccept = stage === 'template-upload'
    ? ['xlsx', 'xls', 'docx', 'doc', 'csv']
    : ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'csv', 'ppt', 'pptx'];

  // Main upload field — shows the picked file, or a card that opens the shared
  // "Add data" upload modal. Replaces the old inline dropzone.
  const mainUploadField = (label: string, hint: string) => (
    reportFiles.length > 0 ? (
      <div>
        <ul className="space-y-2">
          {reportFiles.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-3 px-4 py-3 border border-canvas-border rounded-lg bg-canvas">
              <div className="w-9 h-9 rounded-md bg-compliant-50 text-compliant-700 flex items-center justify-center shrink-0"><FileText size={16} /></div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-ink-900 truncate">{f.name}</div>
                <div className="text-xs text-ink-500 flex items-center gap-1.5"><CheckCircle2 size={11} className="text-compliant" /> Ready · {formatBytes(f.size)}</div>
              </div>
              <button onClick={() => removeReportFile(i)} className="w-7 h-7 rounded-full text-ink-500 hover:text-risk-700 hover:bg-risk-50 flex items-center justify-center cursor-pointer shrink-0" aria-label={`Remove ${f.name}`}><X size={14} /></button>
            </li>
          ))}
        </ul>
        <Button variant="outline" size="md" leftIcon={<Upload size={15} />} onClick={() => setMainUploadOpen(true)} className="w-full mt-2">
          Add more files
        </Button>
      </div>
    ) : (
      <div>
        <button type="button" onClick={() => setMainUploadOpen(true)}
          className={`w-full flex flex-col items-center justify-center text-center py-10 px-6 rounded-lg border-2 border-dashed transition-colors cursor-pointer ${fileError ? 'border-risk/60 bg-risk-50/40' : 'border-canvas-border bg-canvas hover:border-brand-300 hover:bg-brand-50/40'}`}>
          <Upload size={28} className={`mb-2 ${fileError ? 'text-risk-700' : 'text-ink-400'}`} aria-hidden="true" />
          <span className="text-sm font-semibold text-ink-800">Upload {label}</span>
          <span className="text-xs text-ink-500 mt-0.5">{hint}</span>
          <span className="inline-flex items-center gap-2 mt-3 px-4 h-9 rounded-md bg-brand-600 text-white text-[0.8125rem] font-semibold"><Upload size={14} aria-hidden="true" /> Choose files</span>
        </button>
        {fileError && <div className="text-xs text-risk-700 mt-1.5 flex items-center gap-1"><AlertTriangle size={11} aria-hidden="true" /> Please upload a file to continue.</div>}
      </div>
    )
  );

  // Optional annexures uploader — reused on both the upload and template paths.
  const annexureSection = (
    <div className="mt-4 shrink-0">
      <label className="text-xs font-semibold text-ink-800 mb-1.5 flex items-center gap-1.5">
        <Paperclip size={12} /> Annexures <span className="text-ink-400 font-normal">(optional)</span>
        {embeddedAnnex.length > 0 && <span className="ml-1 text-xs font-semibold text-compliant-700">· {embeddedAnnex.length} auto-added from report</span>}
      </label>
      {(embeddedAnnex.length > 0 || annexFiles.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {embeddedAnnex.map(a => (
            <span key={a.id} className="inline-flex items-center gap-1.5 h-7 pl-2 pr-1 rounded-sm bg-compliant-50 border border-compliant/30 text-xs text-compliant-700">
              <FileSpreadsheet size={11} /><span className="truncate max-w-[150px]" title={a.name}>{a.name.replace(" (from report)", "")}</span>
              <span className="text-xs font-semibold bg-compliant/15 px-1 rounded-full">from report · {a.rows}</span>
              <button onClick={() => setEmbeddedAnnex(prev => prev.filter(x => x.id !== a.id))} className="w-4 h-4 rounded-full text-compliant-700/60 hover:text-risk-700 flex items-center justify-center cursor-pointer"><X size={9} /></button>
            </span>
          ))}
          {annexFiles.map((a, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 h-7 pl-2 pr-1 rounded-sm bg-paper-50 border border-canvas-border text-xs text-ink-700">
              <FileSpreadsheet size={11} className="text-compliant-700" /><span className="truncate max-w-[160px]" title={a.name}>{a.name}</span>
              <button onClick={() => setAnnexFiles(prev => prev.filter((_, j) => j !== i))} className="w-4 h-4 rounded-full text-ink-400 hover:text-risk-700 flex items-center justify-center cursor-pointer"><X size={9} /></button>
            </span>
          ))}
        </div>
      )}
      <button
        onClick={() => setAnnexUploadOpen(true)}
        className="group w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-lg border border-dashed border-canvas-border bg-canvas hover:border-brand-300 hover:bg-brand-50/40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
      >
        <span className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0 transition-colors group-hover:bg-brand-100">
          <Upload size={16} />
        </span>
        <span className="text-left leading-tight">
          <span className="block text-[0.8125rem] font-semibold text-ink-800">{annexFiles.length > 0 ? 'Add more annexures' : 'Upload annexures'}</span>
          <span className="block text-[0.6875rem] text-ink-400 mt-0.5">Excel, PDF or CSV — the exception detail behind your observations</span>
        </span>
      </button>
    </div>
  );

  // Re-derive the embedded-annexure pool from whichever report files remain.
  const syncEmbeddedAnnex = (fs: File[]) => {
    if (fs.length === 0) { setEmbeddedAnnex([]); return; }
    Promise.all(fs.map(extractEmbeddedAnnexures)).then(r => setEmbeddedAnnex(r.flat()));
  };

  // Append one or more report files, skipping any with an unsupported extension.
  const addReportFiles = (incoming: File[]) => {
    const accepted = incoming.filter(f => mainAccept.includes(f.name.split('.').pop()?.toLowerCase() ?? ''));
    const skipped = incoming.length - accepted.length;
    if (skipped > 0) addToast({ type: 'error', message: `Skipped ${skipped} unsupported file${skipped === 1 ? '' : 's'}.` });
    if (accepted.length === 0) return;
    setReportFiles(prev => {
      const next = [...prev, ...accepted];
      syncEmbeddedAnnex(next);
      return next;
    });
    setFileError(false);
  };

  const removeReportFile = (idx: number) => {
    setReportFiles(prev => {
      const next = prev.filter((_, i) => i !== idx);
      syncEmbeddedAnnex(next);
      return next;
    });
  };

  const runExtraction = async () => {
    if (reportFiles.length === 0) return;
    if (!auditTitle) setAuditTitle(baseName(reportFiles[0].name));
    setProcMsg(0);
    setStage('processing');
    // Parse every uploaded report file and combine their observations.
    // parseObservationsFromFile returns null for unparseable types (PDF, Word,
    // .doc) — drop those so we cleanly fall back to the sample seed instead of
    // carrying a null into toWorkObs (which would throw and stall processing).
    const parsed = (await Promise.all(reportFiles.map(parseObservationsFromFile))).flatMap(r => r ?? []);
    const useReal = parsed.length > 0;
    const obs = useReal ? parsed : SAMPLE_OBSERVATIONS;
    const ins = useReal ? [] : SAMPLE_INSIGHTS;
    // Annexure pool: first whatever's embedded in the report file, then any
    // separately-uploaded annexures; fall back to the demo pool only if neither.
    const uploaded = annexFiles.length > 0 ? await parseAnnexureFiles(annexFiles) : [];
    const combined = [...embeddedAnnex, ...uploaded];
    const pool = combined.length > 0 ? combined : ANNEXURE_POOL;
    window.setTimeout(() => {
      if (obs.length === 0) { setStage('report-upload'); addToast({ type: 'error', message: 'No structured observations found. Try the template, or a clearer report.' }); return; }
      setAnnexurePool(pool);
      setWorkObs(toWorkObs(obs, pool));
      setInsights(ins);
      setStage('validation');
      addToast({ type: 'success', message: `Extracted ${obs.length} observation${obs.length === 1 ? '' : 's'}.` });
      if (embeddedAnnex.length > 0) addToast({ type: 'info', message: `Fetched ${embeddedAnnex.length} annexure${embeddedAnnex.length === 1 ? '' : 's'} embedded in the report.` });
    }, 2200);
  };

  const importEngagement = (id: string) => {
    const eng = ENGAGEMENT_SOURCES.find(e => e.id === id);
    if (!eng) return;
    const obs = eng.observations();
    if (!auditTitle) setAuditTitle(eng.name);
    // Pre-fill the Audit Period date fields from the engagement's fiscal range;
    // keep the friendly quarter label as the display string. User can override.
    setPeriodFrom(eng.periodStart);
    setPeriodTo(eng.periodEnd);
    setAuditPeriod(eng.period);
    setAnnexurePool(ANNEXURE_POOL);
    setWorkObs(toWorkObs(obs, ANNEXURE_POOL));
    setInsights(regenerateInsights(obs));
    setStage('validation');
    addToast({ type: 'success', message: `Imported ${obs.length} observation${obs.length === 1 ? '' : 's'} from ${eng.name}.` });
  };

  const continueManual = () => {
    const valid = manualObs.filter(o => o.title.trim());
    if (valid.length === 0) { addToast({ type: 'error', message: 'Add at least one observation with a title.' }); return; }
    setAnnexurePool(ANNEXURE_POOL);
    setWorkObs(toWorkObs(valid, ANNEXURE_POOL));
    setInsights(regenerateInsights(valid));
    setStage('annexures');
  };

  // Switching the input path resets any path-scoped validation so a red error
  // from one path never bleeds into another (e.g. the "upload a file" error).
  const selectPath = (mode: StartMode) => {
    if (mode === startMode) return;
    setStartMode(mode);
    setFileError(false);
  };

  // Back clears any path-specific validation state so it doesn't bleed across paths.
  const goBack = () => { setFileError(false); setReviewerOpen(false); setStage(backStage(stage)); };
  const goPreview = () => { setPreviewObs(toAtrObservations(workObs)); setPreviewEditing(false); setStage('preview'); };
  const goManageExceptions = (observations: AtrObservation[]) => {
    if (!onManageExceptions) { addToast({ type: 'info', message: 'Manage Exceptions is not available here.' }); return; }
    // Park the in-progress ATR so the user can return and finalize after review.
    saveAtrDraft({ meta, observations, insights });
    addToast({ type: 'info', message: 'ATR saved — finish reviewing exceptions, then return to generate it.' });
    onManageExceptions();
    onClose();
  };
  const regenInsights = () => { setInsights(regenerateInsights(previewObs)); addToast({ type: 'success', message: 'Key Insights regenerated.' }); };

  const setPeriod = (from: string, to: string) => {
    setPeriodFrom(from); setPeriodTo(to);
    const f = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    setAuditPeriod(from && to ? `${f(from)} – ${f(to)}` : (f(from) || f(to)));
  };

  const handleDownload = (kind: 'pdf' | 'word' | 'excel') => {
    setShowFormats(false);
    if (kind === 'excel') { exportAtrExcel(meta, previewObs); addToast({ type: 'success', message: 'ATR exported to Excel.' }); return; }
    if (kind === 'word') { exportAtrWord(meta, previewObs); addToast({ type: 'success', message: 'ATR exported to Word.' }); return; }
    // Apply the chosen page orientation + font scale via an injected @page rule.
    const prev = document.getElementById('atr-print-opts');
    if (prev) prev.remove();
    const styleEl = document.createElement('style');
    styleEl.id = 'atr-print-opts';
    styleEl.textContent = `@page { size: A4 ${pdfOrientation}; } @media print { .report-printable { font-size: ${pdfFontScale}% !important; } }`;
    document.head.appendChild(styleEl);
    addToast({ type: 'info', message: `Print view opened at ${pdfOrientation}, ${pdfFontScale}% font. Choose “Save as PDF” to keep the file.` });
    window.setTimeout(() => window.print(), 250);
  };

  // ── Stepper active index ──
  const activeStep = STEPPER.findIndex(s => s.stages.includes(stage));
  const stepBackTarget = (key: string): Stage =>
    key === 'start' ? 'entry' : key === 'validate' ? (startMode === 'manual' ? 'manual-edit' : 'validation') : key === 'annexures' ? 'annexures' : 'decision';
  const canContinueValidation = selectedCount(workObs) > 0 && unresolvedCount(workObs) === 0;
  const selForAnnex = workObs.filter(o => o.selected);
  const linkedRows = totalExceptionRows(workObs);

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-[rgba(15,8,30,0.78)] backdrop-blur-[6px] z-50" onClick={requestClose} />
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.98, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[1040px] max-w-[95vw] h-[680px] max-h-[92vh] bg-canvas-elevated rounded-xl shadow-xl border border-canvas-border z-[60] flex flex-col"
        role="dialog" aria-modal="true" aria-label="ATR Builder" tabIndex={-1}
      >
        {/* Header + inline stepper — one compact row so the header stays tight
            (mirrors the report wizard). The step rail sits inline on the right;
            done steps stay clickable to jump back. */}
        <header className="shrink-0 px-6 py-3 border-b border-canvas-border flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 flex items-center justify-center shrink-0 ring-1 ring-brand-200/60"><Sparkles size={16} /></div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[0.9375rem] font-semibold text-ink-900 leading-tight truncate">Build an Action Taken Report</h2>
            <p className="text-[0.75rem] text-ink-500 leading-snug truncate">Start from a template or report, validate, link annexures, then generate.</p>
          </div>
          {/* Compact step rail — slim dots + labels, no heavy pill chrome. */}
          <nav aria-label="Progress" className="hidden md:flex items-center gap-2.5 shrink-0">
            {STEPPER.map((s, i) => {
              const state = i < activeStep ? 'done' : i === activeStep ? 'active' : 'todo';
              const canGoBack = state === 'done' && stage !== 'processing';
              const tip = state === 'done' ? 'Click to go back to this step'
                : state === 'active' ? STEP_TIP[s.key]
                : `Complete Step ${activeStep + 1} to unlock`;
              return (
                <div key={s.key} className="flex items-center gap-2.5">
                  <button
                    type="button"
                    title={tip}
                    aria-label={canGoBack ? `Go back to ${s.label}` : undefined}
                    aria-disabled={!canGoBack}
                    aria-current={state === 'active' ? 'step' : undefined}
                    onClick={() => canGoBack && setStage(stepBackTarget(s.key))}
                    className={`group inline-flex items-center gap-1.5 text-[0.75rem] whitespace-nowrap rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 ${state === 'active' ? 'font-semibold text-brand-700' : state === 'done' ? 'font-medium text-ink-600 hover:text-compliant-700 cursor-pointer' : 'font-medium text-ink-400 cursor-not-allowed'}`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[0.625rem] font-semibold transition-colors ${state === 'active' ? 'bg-brand-600 text-white' : state === 'done' ? 'bg-compliant text-white' : 'bg-white text-ink-400 ring-1 ring-canvas-border'}`}>{state === 'done' ? <Check size={11} strokeWidth={3} /> : i + 1}</span>
                    {s.label}
                    {canGoBack && <ArrowLeft size={11} className="-mr-0.5 max-w-0 opacity-0 group-hover:max-w-[14px] group-hover:opacity-100 transition-all duration-150" />}
                  </button>
                  {i < STEPPER.length - 1 && <span className="w-5 h-px bg-canvas-border" aria-hidden="true" />}
                </div>
              );
            })}
          </nav>
          <button onClick={requestClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-draft-50 flex items-center justify-center cursor-pointer shrink-0" aria-label="Close"><X size={16} /></button>
        </header>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Stage 0 — Entry. NOTE: the "Import from Engagement" path is hidden
              for now (kept in code — importEngagement + the engagement-pick stage
              stay intact — so it can be re-enabled later). */}
          {stage === 'entry' && (
            <div className="px-8 py-5">
              <h3 className="text-base font-semibold text-ink-900 mb-0.5">How would you like to start?</h3>
              <p className="text-xs text-ink-500 mb-4">Choose the input that matches what you have.</p>

              {/* Input paths — flat, bordered cards. Selection = brand border +
                  a light brand wash + a filled brand icon. No gradients, glows,
                  decorative shadows or hover-float. */}
              <div className="grid grid-cols-3 gap-3">
                {([
                  { mode: 'template' as const, icon: LayoutTemplate, title: 'Use IRAME template', rec: true, desc: 'Download, fill offline, upload back.' },
                  { mode: 'upload' as const, icon: UploadCloud, title: 'Upload a report', rec: false, desc: "We'll extract the observations." },
                  { mode: 'manual' as const, icon: PencilLine, title: 'Enter manually', rec: false, desc: 'Type into an editable table.' },
                ]).map(c => {
                  const active = startMode === c.mode;
                  return (
                    <button key={c.mode} onClick={() => selectPath(c.mode)} aria-pressed={active} className={`group relative flex flex-col rounded-lg border p-4 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 ${active ? 'border-brand-600 bg-brand-50/50' : 'border-canvas-border bg-canvas-elevated hover:border-brand-300 hover:bg-canvas'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${active ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-700 group-hover:bg-brand-100'}`}><c.icon size={18} strokeWidth={2} /></span>
                        {c.rec && <span className="inline-flex items-center h-5 px-2 rounded-full bg-brand-50 text-brand-700 border border-brand-200 text-[0.625rem] font-semibold uppercase tracking-[0.08em]">Recommended</span>}
                        {active && !c.rec && <Check size={16} className="text-brand-600 shrink-0" strokeWidth={2.5} aria-hidden="true" />}
                      </div>
                      <div className="mt-4">
                        <div className="text-[0.9375rem] font-semibold text-ink-900 leading-tight">{c.title}</div>
                        <p className="text-[0.8125rem] text-ink-500 leading-snug mt-1">{c.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected-path action + the "captures" reference share one full-width row */}
              <div className="mt-4 grid grid-cols-[1.35fr_1fr] gap-4 items-stretch">
                {/* Left — the one thing this path needs */}
                {startMode === 'template' && (
                  <div className="rounded-lg border border-canvas-border bg-canvas p-4 h-full">
                    <div className="text-[0.8125rem] font-semibold text-ink-900">Download the template</div>
                    <p className="text-[0.75rem] text-ink-500 leading-relaxed mt-0.5 mb-3">Fill one row per observation, then upload it on the next step.</p>
                    <div className="space-y-1.5">
                      {([
                        { key: 'excel', icon: FileSpreadsheet, tint: 'bg-compliant-50 text-compliant-700', title: 'Excel template', ext: '.xlsx', dashed: false, onClick: () => { downloadExcelTemplate(); markDownloaded('excel'); addToast({ type: 'success', message: 'Excel template downloaded.' }); } },
                        { key: 'word', icon: FileText, tint: 'bg-brand-50 text-brand-700', title: 'Word template', ext: '.doc', dashed: false, onClick: () => { downloadWordTemplate(); markDownloaded('word'); addToast({ type: 'success', message: 'Word template downloaded.' }); } },
                        { key: 'sample', icon: Sparkles, tint: 'bg-draft-50 text-ink-500', title: 'Filled sample', ext: 'example data', dashed: true, onClick: () => { exportAtrExcel({ reportId: 'ATR-SAMPLE' }, SAMPLE_OBSERVATIONS); markDownloaded('sample'); addToast({ type: 'success', message: 'Filled sample downloaded.' }); } },
                      ] as const).map(opt => {
                        const done = downloadedTmpls.has(opt.key);
                        return (
                          <button key={opt.key} onClick={opt.onClick}
                            className={`group flex items-center gap-3 w-full h-11 pl-2.5 pr-3 rounded-lg border transition-colors cursor-pointer text-left ${done ? 'border-compliant-200 bg-compliant-50/50' : `bg-canvas-elevated hover:border-brand-300 hover:bg-canvas ${opt.dashed ? 'border-dashed border-canvas-border' : 'border-canvas-border'}`}`}>
                            <span className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${opt.tint}`}><opt.icon size={16} /></span>
                            <span className="flex-1 min-w-0 text-[0.8125rem] font-medium text-ink-800 truncate">{opt.title} <span className="text-ink-400 font-normal">· {opt.ext}</span></span>
                            {done
                              ? <span className="text-[0.75rem] font-semibold text-compliant-700 flex items-center gap-1 shrink-0"><Check size={13} /> Downloaded</span>
                              : <span className="text-[0.75rem] font-semibold text-brand-700 flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100"><Download size={14} /> Download</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {startMode === 'upload' && (
                  <div className="rounded-lg border border-canvas-border bg-canvas p-4 h-full flex items-center gap-3">
                    <FileCheck2 size={16} className="text-brand-600 shrink-0 mt-0.5" />
                    <p className="text-[0.75rem] text-ink-600 leading-relaxed">Upload any PDF, Word, Excel or CSV report on the next step. We'll extract the observations, risks, recommendations and evidence — you'll review everything before it's finalized.</p>
                  </div>
                )}
                {startMode === 'manual' && (
                  <div className="rounded-lg border border-canvas-border bg-canvas p-4 h-full flex items-center gap-3">
                    <PencilLine size={16} className="text-brand-600 shrink-0 mt-0.5" />
                    <p className="text-[0.75rem] text-ink-600 leading-relaxed">Add observations row by row on the next step — title, risk, classification, status and action plans. Each row becomes one observation.</p>
                  </div>
                )}

                {/* Right — what every observation captures. Neutral card; a small
                    brand check per field reads as a spec, not a decorated panel. */}
                <div className="rounded-lg border border-canvas-border bg-canvas p-4 h-full">
                  <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-400 mb-3">Each observation captures</div>
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {[REQUIRED_FIELDS[0].label, 'Category / Area', ...REQUIRED_FIELDS.slice(1).map(f => f.label)].map(label => (
                      <li key={label} className="flex items-start gap-2 text-[0.8125rem] text-ink-700 leading-snug">
                        <Check size={13} className="text-brand-500 mt-0.5 shrink-0" strokeWidth={2.5} aria-hidden="true" /> {label}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Stage 1A.2/3 — Upload filled template */}
          {stage === 'template-upload' && (
            <div className="p-6 h-full flex flex-col">
              <h3 className="text-base font-semibold text-ink-900 mb-0.5">Upload your filled template</h3>
              <p className="text-xs text-ink-500 mb-4">We'll extract every observation and let you review before anything is finalized.</p>
              {mainUploadField('filled template', 'Excel / Word / CSV · max 25 MB')}
              {annexureSection}
            </div>
          )}

          {/* Stage 1B — Upload report */}
          {stage === 'report-upload' && (
            <div className="p-6 h-full flex flex-col">
              <h3 className="text-base font-semibold text-ink-900 mb-0.5">Upload your audit report</h3>
              <p className="text-xs text-ink-500 mb-4">We'll extract all required ATR details. You'll review before anything is finalized.</p>
              {mainUploadField('report', 'PDF / Word / Excel / PPT · Excel & CSV read for real')}
              {annexureSection}
            </div>
          )}

          {/* Stage: Import from Engagement */}
          {stage === 'engagement-pick' && (
            <div className="p-6">
              <h3 className="text-base font-semibold text-ink-900 mb-1">Import from an engagement</h3>
              <p className="text-xs text-ink-500 mb-4">Pick an engagement — we'll pull its observations into the ATR for you to review.</p>
              <div className="space-y-2.5">
                {ENGAGEMENT_SOURCES.map(eng => {
                  const obs = eng.observations();
                  const n = obs.length;
                  const st = statusBreakdown(obs);
                  const ready = n > 0 && st.Complete === n; // all findings remediated
                  // Report-readiness at a glance: how many findings are remediated.
                  const chips = ([
                    ['Complete', st.Complete, 'bg-compliant-50 text-compliant-700'],
                    ['In Progress', st['In Progress'], 'bg-mitigated-50 text-mitigated-700'],
                    ['Open', st.Open, 'bg-paper-50 text-ink-600 border border-canvas-border'],
                    ['Overdue', st.Overdue, 'bg-risk-50 text-risk-700'],
                  ] as const).filter(([, c]) => c > 0);
                  return (
                    <button key={eng.id} onClick={() => importEngagement(eng.id)} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-canvas-border bg-canvas hover:border-brand-300 hover:bg-brand-50/30 transition-colors cursor-pointer text-left">
                      <span className="w-9 h-9 rounded-lg bg-evidence-50 text-evidence-700 flex items-center justify-center shrink-0"><Briefcase size={17} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-ink-900 truncate">{eng.name}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-ink-500">{eng.period} · {n} observation{n === 1 ? '' : 's'}</span>
                          {chips.map(([label, count, cls]) => (
                            <span key={label} className={`inline-flex items-center h-[18px] px-1.5 rounded-full text-xs font-semibold tabular-nums ${cls}`}>{count} {label}</span>
                          ))}
                        </span>
                      </span>
                      {ready && <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-compliant-50 text-compliant-700 border border-compliant/30 text-xs font-semibold shrink-0" title="All observations are remediated"><CheckCircle2 size={11} /> ATR ready</span>}
                      <ArrowRight size={16} className="text-ink-400 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stage: Manual observation entry */}
          {stage === 'manual-edit' && (
            <div>
              <div className="px-6 pt-5 pb-1">
                <div className="flex items-start gap-2 text-xs text-ink-500 border border-canvas-border bg-canvas rounded-md px-3 py-2">
                  <PencilLine size={14} className="mt-0.5 shrink-0 text-brand-600" />
                  <span>Enter your observations directly. Add as many as you need — each becomes a section in the ATR.</span>
                </div>
              </div>
              <AtrItemsEditor observations={manualObs} onChange={setManualObs} />
            </div>
          )}

          {/* Processing */}
          {stage === 'processing' && (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-24">
              <div className="relative"><Loader2 size={32} className="text-brand-600 animate-spin" /><Sparkles size={14} className="text-brand-500 absolute -top-1 -right-1" /></div>
              <div className="text-center">
                <p className="text-base font-semibold text-ink-900 mb-1">{PROCESS_MESSAGES[procMsg]}</p>
                <p className="text-sm text-ink-500">Reading <span className="font-mono text-ink-700">{reportFiles.length > 1 ? `${reportFiles.length} files` : reportFiles[0]?.name ?? 'your report'}</span> and mapping it into the ATR format.</p>
              </div>
              <div className="w-56 h-1 rounded-full bg-draft-50 overflow-hidden"><div className="h-full bg-brand-500 transition-all duration-500" style={{ width: `${((procMsg + 1) / PROCESS_MESSAGES.length) * 100}%` }} /></div>
            </div>
          )}

          {/* Stage 2 */}
          {stage === 'validation' && <AtrValidationStep observations={workObs} onChange={setWorkObs} />}

          {/* Stage 3 */}
          {stage === 'annexures' && <AtrAnnexureStep observations={workObs} pool={annexurePool} onChange={setWorkObs} />}

          {/* Stage 4 — Decision */}
          {stage === 'decision' && (
            <div className="p-6">
              <h3 className="text-base font-semibold text-ink-900 mb-1">How would you like to proceed?</h3>
              <p className="text-sm text-ink-500 mb-6">{selForAnnex.length} observation{selForAnnex.length === 1 ? '' : 's'} · {linkedRows} linked exception row{linkedRows === 1 ? '' : 's'}.</p>
              <div className="grid grid-cols-2 gap-4 max-w-[720px] items-stretch">
                <button onClick={() => setDecisionChoice('generate')} aria-pressed={decisionChoice === 'generate'}
                  className={`relative flex flex-col text-left rounded-xl border p-5 transition-all duration-200 cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 ${decisionChoice === 'generate' ? 'border-brand-500 bg-brand-50/50 shadow-md shadow-brand-900/[0.06]' : 'border-canvas-border bg-canvas-elevated hover:border-brand-300 hover:bg-brand-50/20 hover:-translate-y-0.5 hover:shadow-md hover:shadow-brand-900/[0.05]'}`}>
                  <span className={`w-12 h-12 rounded-lg flex items-center justify-center mb-3 transition-all duration-200 ${decisionChoice === 'generate' ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30 scale-[1.03]' : 'bg-brand-50 text-brand-700'}`}><FileText size={21} /></span>
                  <div className="text-base font-semibold text-ink-900 mb-1">Generate ATR only</div>
                  <p className="text-xs text-ink-500 leading-relaxed">Skip case management and go straight to the ATR preview. You can come back and manage exceptions later.</p>
                  <p className="mt-auto pt-3 inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 bg-brand-50 rounded-sm px-2 py-1">
                    <ArrowRight size={11} className="shrink-0" /> Goes straight to the ATR preview.
                  </p>
                </button>
                <button onClick={() => setDecisionChoice('manage')} aria-pressed={decisionChoice === 'manage'}
                  className={`relative flex flex-col text-left rounded-xl border p-5 transition-all duration-200 cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-evidence-600/40 ${decisionChoice === 'manage' ? 'border-evidence-500 bg-evidence-50/40 shadow-md shadow-brand-900/[0.06]' : 'border-canvas-border bg-canvas-elevated hover:border-evidence-300 hover:bg-evidence-50/20 hover:-translate-y-0.5 hover:shadow-md hover:shadow-brand-900/[0.05]'}`}>
                  <span className={`w-12 h-12 rounded-lg flex items-center justify-center mb-3 transition-all duration-200 ${decisionChoice === 'manage' ? 'bg-evidence-600 text-white shadow-md shadow-evidence-600/30 scale-[1.03]' : 'bg-evidence-50 text-evidence-700'}`}><ListChecks size={21} /></span>
                  <div className="text-base font-semibold text-ink-900 mb-1">Manage exceptions first</div>
                  <p className="text-xs text-ink-500 leading-relaxed">Review the exception cases linked to observations before generating. Classify, assign action plans, and review evidence.</p>
                  <p className="mt-auto pt-3 inline-flex items-center gap-1.5 text-xs font-medium text-evidence-700 bg-evidence-50 rounded-sm px-2 py-1">
                    <ArrowRight size={11} className="shrink-0" /> Opens Manage Exceptions — generate the ATR after reviewing.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Stage: Customize */}
          {stage === 'customize' && (
            <div className="p-6 space-y-5">
              <div>
                <h3 className="text-base font-semibold text-ink-900 mb-0.5">Customize the report</h3>
                <p className="text-xs text-ink-500">Cover details, audit period, reviewer and branding — all optional.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-ink-800 mb-1.5 flex items-center justify-between">
                    <span>Audit Title <span className="text-ink-400 font-normal">· report name</span></span>
                    {!auditTitle && <button onClick={() => setAuditTitle(`Action Taken Report — ${new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`)} className="text-xs font-semibold text-brand-700 hover:underline cursor-pointer">Suggest a name</button>}
                  </label>
                  <input value={auditTitle} onChange={e => setAuditTitle(e.target.value)} placeholder="e.g. Procure-to-Pay Controls Review" className="w-full px-3 py-2.5 rounded-md border border-canvas-border text-sm text-ink-900 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15" />
                  <div className="text-xs text-ink-500 mt-1">Saved to My Reports as this name.</div>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-ink-800 mb-1.5 block">Audit Entity</label>
                  <input value={auditEntity} onChange={e => setAuditEntity(e.target.value)} placeholder="e.g. Acme Corp — Internal Audit" className="w-full px-3 py-2.5 rounded-md border border-canvas-border text-sm text-ink-900 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-ink-800 mb-1.5 flex items-center gap-1.5"><Calendar size={12} /> Audit Period</label>
                  <div className="flex items-center gap-2">
                    <input type="date" value={periodFrom} onChange={e => setPeriod(e.target.value, periodTo)} className="flex-1 px-3 py-2.5 rounded-md border border-canvas-border text-sm text-ink-900 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15" />
                    <span className="text-ink-400 text-xs">to</span>
                    <input type="date" value={periodTo} onChange={e => setPeriod(periodFrom, e.target.value)} className="flex-1 px-3 py-2.5 rounded-md border border-canvas-border text-sm text-ink-900 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15" />
                  </div>
                  {auditPeriod && <div className="text-xs text-ink-500 mt-1">Shows as: <span className="font-medium text-ink-700">{auditPeriod}</span></div>}
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-800 mb-1.5 block">Prepared By</label>
                  <input value={preparedBy} onChange={e => setPreparedBy(e.target.value)} placeholder="Internal Audit Team" className="w-full px-3 py-2.5 rounded-md border border-canvas-border text-sm text-ink-900 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15" />
                </div>
                <div className="relative">
                  <label className="text-xs font-semibold text-ink-800 mb-1.5 block">Reviewed By</label>
                  <input value={reviewedBy} onChange={e => { setReviewedBy(e.target.value); setReviewerOpen(true); }} onFocus={() => setReviewerOpen(true)} placeholder="Search team members…" className="w-full px-3 py-2.5 rounded-md border border-canvas-border text-sm text-ink-900 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15" />
                  {reviewerOpen && reviewerMatches.length > 0 && (
                    <>
                      <div className="fixed inset-0 z-[65]" onClick={() => setReviewerOpen(false)} />
                      <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[70] max-h-44 overflow-y-auto bg-white border border-canvas-border shadow-xl rounded-lg p-1">
                        {reviewerMatches.map(p => (
                          <button key={p.id} onClick={() => { setReviewedBy(p.name); setReviewerOpen(false); }} className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm hover:bg-brand-50 text-left cursor-pointer">
                            <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0">{p.initials}</span>
                            <span className="min-w-0 flex-1"><span className="block text-xs font-medium text-ink-800 truncate">{p.name}</span><span className="block text-xs text-ink-400">{p.role}</span></span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <div className="text-xs text-ink-500 mt-1">Pick from people at Irame, or type a name.</div>
                </div>
              </div>

              {/* Brand color */}
              <div>
                <label className="text-xs font-semibold text-ink-800 mb-1.5 flex items-center gap-1.5"><Palette size={12} /> Brand color</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {THEME_PRESETS.map(t => (
                    <button key={t.color} onClick={() => pickBrand(t.color)} title={t.name} className={`w-9 h-9 rounded-md border-2 transition-transform ${brandColor === t.color ? 'border-ink-900 scale-105' : 'border-transparent'}`} style={{ backgroundColor: t.color }} />
                  ))}
                  <div className="flex items-center gap-1.5 ml-1 pl-1.5 pr-2.5 h-9 rounded-md border border-canvas-border">
                    <input type="color" value={brandColor || '#6a12cd'} onChange={e => pickBrand(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0" aria-label="Pick a color" />
                    <input type="text" value={hexDraft} onChange={e => onHexChange(e.target.value)} placeholder="#6a12cd" maxLength={7} spellCheck={false} className="w-[74px] text-xs font-mono text-ink-700 bg-transparent focus:outline-none placeholder:text-ink-400" aria-label="Hex color code" />
                  </div>
                  {brandColor && <button onClick={() => { setBrandColor(''); setHexDraft(''); }} className="text-xs text-ink-500 hover:text-ink-800 cursor-pointer">Reset</button>}
                </div>
              </div>

              {/* Logo */}
              <div>
                <label className="text-xs font-semibold text-ink-800 mb-1.5 flex items-center gap-1.5"><ImageIcon size={12} /> Company logo</label>
                <input ref={logoInputRef} type="file" accept="image/*" className="sr-only" onChange={e => onLogoPick(e.target.files?.[0])} />
                {logoDataUrl ? (
                  <div className="flex items-center gap-3 px-3 py-2.5 border border-canvas-border rounded-lg bg-canvas">
                    <img src={logoDataUrl} alt="Logo preview" className="h-8 max-w-[120px] object-contain" />
                    <span className="text-xs text-ink-600 flex-1">Logo added — shows on the cover.</span>
                    <button onClick={() => setLogoDataUrl('')} className="text-xs text-ink-500 hover:text-risk-700 cursor-pointer">Remove</button>
                  </div>
                ) : (
                  <button onClick={() => logoInputRef.current?.click()} className="w-full py-3 rounded-lg border border-dashed border-canvas-border text-xs font-medium text-ink-500 hover:border-brand-300 hover:text-brand-700 transition-colors cursor-pointer">+ Upload logo (PNG / JPG / SVG)</button>
                )}
              </div>
            </div>
          )}

          {/* Stage 5A — Preview */}
          {stage === 'preview' && (
            previewEditing
              ? <AtrItemsEditor observations={previewObs} onChange={setPreviewObs} />
              : (
                <div className="bg-draft-50 min-h-full">
                  {resumeDraft && (
                    <div className="mx-6 mt-4 flex items-center gap-2 border border-compliant/30 bg-compliant-50 rounded-md px-3 py-2 text-xs text-compliant-700">
                      <CheckCircle2 size={14} className="shrink-0" />
                      <span><span className="font-semibold">Exceptions reviewed.</span> Your ATR is ready — finalize or save it below.</span>
                    </div>
                  )}
                  <div className="flex items-center justify-end px-6 pt-4">
                    <button onClick={regenInsights} className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold text-brand-700 bg-canvas-elevated border border-canvas-border rounded-md hover:border-brand-300 transition-colors cursor-pointer" title="Regenerate just the Key Insights section">
                      <RefreshCw size={13} /> Regenerate Key Insights
                    </button>
                  </div>
                  <div className="py-4"><AtrDocument meta={meta} observations={previewObs} insights={insights} /></div>
                </div>
              )
          )}
        </div>

        {/* Footer */}
        {stage !== 'processing' && (
          <footer className="shrink-0 px-6 py-3.5 border-t border-canvas-border flex items-center justify-between gap-2">
            {/* Left / back */}
            {stage === 'entry' ? (
              <button onClick={requestClose} className="h-10 px-5 text-sm font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-md hover:border-brand-200 transition-colors cursor-pointer">Cancel</button>
            ) : (
              <button onClick={goBack} className="inline-flex items-center gap-1.5 h-10 px-4 text-sm font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-md hover:border-brand-200 transition-colors cursor-pointer"><ArrowLeft size={14} /> Back</button>
            )}

            {/* Right / primary */}
            {stage === 'entry' && (
              <button onClick={() => setStage(startMode === 'template' ? 'template-upload' : startMode === 'upload' ? 'report-upload' : startMode === 'manual' ? 'manual-edit' : 'engagement-pick')} className="inline-flex items-center gap-2 h-10 px-5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-md transition-colors cursor-pointer">
                {startMode === 'template' ? 'Next: Upload filled template' : startMode === 'upload' ? 'Next: Upload report' : startMode === 'manual' ? 'Next: Enter observations' : 'Next: Pick engagement'} <ArrowRight size={14} />
              </button>
            )}
            {stage === 'manual-edit' && (
              <button onClick={continueManual} className="inline-flex items-center gap-2 h-10 px-5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-md transition-colors cursor-pointer">Continue <ArrowRight size={14} /></button>
            )}
            {stage === 'customize' && (
              <button onClick={goPreview} className="inline-flex items-center gap-2 h-10 px-5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-md transition-colors cursor-pointer">Preview ATR <ArrowRight size={14} /></button>
            )}
            {(stage === 'template-upload' || stage === 'report-upload') && (
              <div className="flex items-center gap-2.5">
                {reportFiles.length === 0 && <span className="text-xs text-ink-400">Upload a file to continue</span>}
                <button
                  onClick={runExtraction}
                  disabled={reportFiles.length === 0}
                  title={reportFiles.length === 0 ? 'Upload a file to continue' : undefined}
                  aria-disabled={reportFiles.length === 0}
                  className={`inline-flex items-center gap-2 h-10 px-5 text-sm font-semibold rounded-md transition-colors ${reportFiles.length > 0 ? 'text-white bg-brand-600 hover:bg-brand-500 cursor-pointer' : 'text-ink-400 bg-draft-50 cursor-not-allowed'}`}
                ><Sparkles size={14} /> Extract observations</button>
              </div>
            )}
            {stage === 'validation' && (
              <div className="flex items-center gap-2.5">
                {!canContinueValidation && <span className="text-xs text-ink-500 flex items-center gap-1"><AlertTriangle size={11} className="text-risk" /> {selectedCount(workObs) === 0 ? 'Select at least one' : 'Resolve missing fields'}</span>}
                <button onClick={() => setStage('annexures')} disabled={!canContinueValidation} className="inline-flex items-center gap-2 h-10 px-5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">Continue <ArrowRight size={14} /></button>
              </div>
            )}
            {stage === 'annexures' && (
              <div className="flex items-center gap-2.5">
                <button onClick={() => setStage('decision')} className="h-10 px-4 text-sm font-medium text-ink-600 hover:text-ink-900 cursor-pointer" title="Manage Exceptions will not be available without annexures">Skip annexures</button>
                <button onClick={() => setStage('decision')} className="inline-flex items-center gap-2 h-10 px-5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-md transition-colors cursor-pointer"><CheckCircle2 size={14} /> Confirm annexure mapping</button>
              </div>
            )}
            {stage === 'preview' && (
              <div className="flex items-center gap-2.5">
                {onManageExceptions && !resumeDraft && (
                  <button onClick={() => goManageExceptions(previewObs)} title="Park this ATR and review exception cases first" className="inline-flex items-center gap-2 h-10 px-3.5 text-sm font-semibold text-evidence-700 bg-evidence-50 border border-evidence-200 rounded-md hover:bg-evidence-100 transition-colors cursor-pointer"><ListChecks size={14} /> Manage Exceptions</button>
                )}
                <button onClick={() => setPreviewEditing(e => !e)} className="inline-flex items-center gap-2 h-10 px-3.5 text-sm font-semibold text-ink-700 bg-canvas-elevated border border-canvas-border rounded-md hover:border-brand-200 transition-colors cursor-pointer"><FilePenLine size={14} /> {previewEditing ? 'Done editing' : 'Edit items'}</button>
                <div className="relative">
                  <button onClick={() => setShowFormats(s => !s)} className="inline-flex items-center gap-2 h-10 px-3.5 text-sm font-semibold text-ink-700 bg-canvas-elevated border border-canvas-border rounded-md hover:border-brand-200 transition-colors cursor-pointer"><Download size={14} /> Preview &amp; Download <ChevronDown size={12} className={showFormats ? 'rotate-180' : ''} /></button>
                  {showFormats && (
                    <>
                      <div className="fixed inset-0 z-[65]" onClick={() => setShowFormats(false)} />
                      <div className="absolute right-0 bottom-full mb-1.5 z-[70] bg-white border border-canvas-border shadow-xl py-2 w-60 rounded-lg overflow-hidden">
                        {/* PDF page options */}
                        <div className="px-3 pb-2 mb-1 border-b border-canvas-border">
                          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-ink-500 mb-2"><SlidersHorizontal size={11} /> PDF options</div>
                          <div className="flex gap-1.5 mb-2">
                            {(['portrait', 'landscape'] as const).map(o => (
                              <button key={o} onClick={() => setPdfOrientation(o)} className={`flex-1 h-7 rounded-sm text-xs font-semibold capitalize transition-colors cursor-pointer ${pdfOrientation === o ? 'bg-brand-600 text-white' : 'bg-paper-50 text-ink-600 hover:bg-paper-100'}`}>{o}</button>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-ink-500 shrink-0">Font</span>
                            <input type="range" min={80} max={120} step={5} value={pdfFontScale} onChange={e => setPdfFontScale(Number(e.target.value))} className="flex-1 accent-brand-600 cursor-pointer" />
                            <span className="text-xs font-mono text-ink-600 w-9 text-right">{pdfFontScale}%</span>
                          </div>
                        </div>
                        {[{ k: 'pdf' as const, l: 'Print / Save as PDF' }, { k: 'word' as const, l: 'Download as Word' }, { k: 'excel' as const, l: 'Download as Excel' }].map(f => (
                          <button key={f.k} onClick={() => handleDownload(f.k)} className="w-full text-left px-3 py-2 text-xs text-ink-700 hover:bg-brand-50 hover:text-brand-700 transition-colors cursor-pointer">{f.l}</button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                {onAddToReport && <button onClick={() => onAddToReport(meta, previewObs, insights)} className="inline-flex items-center gap-2 h-10 px-3.5 text-sm font-semibold text-ink-700 bg-canvas-elevated border border-canvas-border rounded-md hover:border-brand-200 transition-colors cursor-pointer"><Save size={14} /> Save Version</button>}
                {onFreeze && <button onClick={() => onFreeze(meta, previewObs, insights)} className="inline-flex items-center gap-2 h-10 px-5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-md transition-colors cursor-pointer"><Lock size={14} /> Finalize &amp; Sign-off</button>}
              </div>
            )}
            {stage === 'engagement-pick' && <span />}
            {stage === 'decision' && (
              decisionChoice === 'generate'
                ? <button onClick={() => setStage('customize')} className="inline-flex items-center gap-2 h-10 px-5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-md transition-colors cursor-pointer"><FileText size={14} /> Generate ATR <ArrowRight size={14} /></button>
                : <button onClick={() => goManageExceptions(toAtrObservations(workObs))} className="inline-flex items-center gap-2 h-10 px-5 text-sm font-semibold text-white bg-evidence-600 hover:bg-evidence-700 rounded-md transition-colors cursor-pointer"><ListChecks size={14} /> Manage exceptions first <ArrowRight size={14} /></button>
            )}
          </footer>
        )}

        {/* Discard-draft confirmation */}
        {confirmClose && (
          <div className="absolute inset-0 z-[80] flex items-center justify-center bg-ink-900/40 rounded-xl">
            <div className="w-[344px] bg-canvas-elevated rounded-lg border border-canvas-border shadow-xl p-5">
              <div className="text-base font-semibold text-ink-900 mb-1">Discard this ATR draft?</div>
              <p className="text-sm text-ink-500 mb-4">Your progress in this builder will be lost. This can't be undone.</p>
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setConfirmClose(false)} className="h-9 px-4 text-sm font-medium text-ink-700 bg-canvas border border-canvas-border rounded-md hover:border-brand-200 cursor-pointer">Keep editing</button>
                <button onClick={() => { setConfirmClose(false); onClose(); }} className="h-9 px-4 text-sm font-semibold text-white bg-risk rounded-md hover:bg-risk-700 cursor-pointer">Discard</button>
              </div>
            </div>
          </div>
        )}

        {/* Shared "Add data" upload modals — main file (template/report) + annexures. */}
        <UploadDataModal
          open={mainUploadOpen}
          onClose={() => setMainUploadOpen(false)}
          title={stage === 'template-upload' ? 'Upload filled template' : 'Upload audit report'}
          allowedTabs={['upload', 'all', 'files', 'folder']}
          hideSessionFiles
          footerHint={stage === 'template-upload'
            ? "Upload your filled template — we'll extract every observation."
            : "Upload your audit report — we'll extract the ATR details."}
          onAttachDraft={({ files }) => { const real = files.map(x => x.file).filter((f): f is File => !!f); if (real.length) addReportFiles(real); }}
        />
        <UploadDataModal
          open={annexUploadOpen}
          onClose={() => setAnnexUploadOpen(false)}
          title="Upload annexures"
          allowedTabs={['upload', 'all', 'files', 'folder']}
          hideSessionFiles
          footerHint="Add annexure workbooks (.xlsx / .csv) for case management."
          onAttachDraft={({ files }) => {
            const real = files
              .map(x => x.file)
              .filter((f): f is File => !!f && ['xlsx', 'xls', 'csv'].includes(f.name.split('.').pop()?.toLowerCase() ?? ''));
            if (real.length) setAnnexFiles(prev => [...prev, ...real]);
          }}
        />
      </motion.div>
    </>
  );
}

function backStage(stage: Stage): Stage {
  switch (stage) {
    case 'template-upload': return 'entry';
    case 'report-upload': return 'entry';
    case 'engagement-pick': return 'entry';
    case 'manual-edit': return 'entry';
    case 'validation': return 'report-upload';
    case 'annexures': return 'validation';
    case 'decision': return 'annexures';
    case 'customize': return 'decision';
    case 'preview': return 'customize';
    default: return 'entry';
  }
}

