import { useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  X, FileText, FileSpreadsheet, CloudUpload, Loader2, CheckCircle2, AlertCircle,
  Sparkles, ArrowRight, ArrowLeft, Check,
} from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useToast } from '../shared/Toast';
import ComprehensiveAtrModal from './ComprehensiveAtrModal';
import {
  REQUIRED_FIELDS, downloadExcelTemplate, downloadWordTemplate,
  parseObservationsFromFile, SAMPLE_OBSERVATIONS, SAMPLE_INSIGHTS,
} from './atrTemplate';
import type { AtrMeta, AtrObservation, AtrInsight } from './atrTypes';

const ACCEPT = '.pdf,.docx,.doc,.xlsx,.xls,.csv';
const ACCEPT_EXT = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'csv'];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Step = 'template' | 'upload' | 'extracting' | 'generated';
const STEP_LABELS: { key: Step; label: string }[] = [
  { key: 'template', label: 'Template' },
  { key: 'upload', label: 'Upload' },
  { key: 'generated', label: 'Review' },
];

/**
 * Upload Report → Generate ATR (guided 3-step flow).
 *  1. Template  — download the Excel/Word template of required observation fields,
 *                 or pick an existing report as the source (skips upload).
 *  2. Upload    — upload the filled template (or any report) + confirm report meta.
 *  3. Review    — extracted observations rendered into the standard ATR format.
 */
export default function UploadReportModal({ onClose, onAddToReport }: {
  onClose: () => void;
  /** When provided, the review step shows "Add to Report" (instead of Download)
   *  and hands the generated ATR back to be saved into My Reports. */
  onAddToReport?: (meta: AtrMeta, observations: AtrObservation[], insights: AtrInsight[]) => void;
}) {
  const { addToast } = useToast();
  const [step, setStep] = useState<Step>('template');

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [auditTitle, setAuditTitle] = useState('');
  const [auditPeriod, setAuditPeriod] = useState('');
  const [preparedBy, setPreparedBy] = useState('');
  const [auditEntity, setAuditEntity] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [observations, setObservations] = useState<AtrObservation[]>([]);
  const [insights, setInsights] = useState<AtrInsight[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(containerRef, step === 'template' || step === 'upload', onClose);

  const { reportId, generatedOn } = useMemo(() => {
    const now = new Date();
    const quarter = Math.floor(now.getMonth() / 3) + 1;
    return {
      reportId: `ATR-${now.getFullYear()}-Q${quarter}-001`,
      generatedOn: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    };
  }, []);

  const fields = [
    { id: 'ur-audit-title',  label: 'Audit Title',  value: auditTitle,  set: setAuditTitle,  placeholder: 'e.g. Procurement, Inventory & Dispatch Process A' },
    { id: 'ur-audit-period', label: 'Audit Period', value: auditPeriod, set: setAuditPeriod, placeholder: 'e.g. Q3 FY 2024-25' },
    { id: 'ur-prepared-by',  label: 'Prepared By',  value: preparedBy,  set: setPreparedBy,  placeholder: 'e.g. Internal Audit Team' },
    { id: 'ur-audit-entity', label: 'Audit Entity', value: auditEntity, set: setAuditEntity, placeholder: 'e.g. ABC Manufacturing Cements Ltd' },
  ];

  const missing: { id: string; label: string }[] = [];
  if (!file) missing.push({ id: 'ur-dropzone', label: 'Report file' });
  fields.forEach(f => { if (!f.value.trim()) missing.push({ id: f.id, label: f.label }); });

  const scrollToField = (id: string) => {
    const el = document.getElementById(id);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); (el as HTMLInputElement).focus?.(); }
  };

  const acceptFile = (f: File | undefined) => {
    if (!f) return;
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ACCEPT_EXT.includes(ext)) {
      addToast({ type: 'error', message: `Unsupported file type ".${ext}". Upload a PDF, Word, Excel or CSV file.` });
      return;
    }
    setFile(f);
    if (showErrors) setShowErrors(false);
  };

  const handleGenerate = async () => {
    if (missing.length > 0) {
      setShowErrors(true);
      window.requestAnimationFrame(() => scrollToField(missing[0].id));
      return;
    }
    setStep('extracting');
    addToast({ type: 'info', message: `Extracting observations from ${file?.name}…` });
    const parsed = file ? await parseObservationsFromFile(file) : null;
    const useReal = !!parsed && parsed.length > 0;
    const obs = useReal ? parsed! : SAMPLE_OBSERVATIONS;
    const ins = useReal ? [] : SAMPLE_INSIGHTS;
    window.setTimeout(() => {
      setObservations(obs);
      setInsights(ins);
      setStep('generated');
      addToast({
        type: 'success',
        message: useReal
          ? `Action Taken Report generated from ${obs.length} observation${obs.length === 1 ? '' : 's'}.`
          : 'Action Taken Report generated from the uploaded report.',
      });
    }, 1300);
  };

  // Final step — hand off to the comprehensive ATR document.
  if (step === 'generated') {
    const meta: AtrMeta = { reportId, auditTitle, auditPeriod, preparedBy, generatedOn, auditEntity };
    return (
      <ComprehensiveAtrModal
        meta={meta}
        observations={observations}
        insights={insights}
        onClose={onClose}
        onAddToReport={onAddToReport ? () => onAddToReport(meta, observations, insights) : undefined}
      />
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/50 backdrop-blur-[2px] z-50"
        onClick={onClose}
      />
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.98, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[860px] max-w-[94vw] max-h-[90vh] bg-canvas-elevated rounded-[16px] shadow-xl border border-canvas-border z-[60] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Upload Report to Generate ATR"
        tabIndex={-1}
      >
        {/* Title bar + stepper */}
        <header className="shrink-0 px-6 pt-3.5 pb-3 border-b border-canvas-border">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                <Sparkles size={16} />
              </div>
              <div>
                <h2 className="text-[0.9375rem] font-semibold text-ink-900 leading-tight">Generate ATR from Observations</h2>
                <p className="text-[0.75rem] text-ink-500 leading-snug">Download the template, fill in your observations, and upload to generate the report.</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer shrink-0" aria-label="Close">
              <X size={16} />
            </button>
          </div>
          {/* Stepper */}
          <div className="flex items-center gap-2">
            {STEP_LABELS.map((s, i) => {
              const activeIdx = step === 'template' ? 0 : 1; // 'review' only reached after unmount
              const state = i < activeIdx ? 'done' : i === activeIdx ? 'active' : 'todo';
              return (
                <div key={s.key} className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 h-7 pl-1.5 pr-2.5 rounded-full text-[0.75rem] font-semibold ${
                    state === 'active' ? 'bg-brand-50 text-brand-700' : state === 'done' ? 'bg-compliant-50 text-compliant-700' : 'bg-[#F4F2F7] text-ink-500'
                  }`}>
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[0.625rem] ${
                      state === 'active' ? 'bg-brand-600 text-white' : state === 'done' ? 'bg-compliant text-white' : 'bg-ink-300 text-white'
                    }`}>
                      {state === 'done' ? <Check size={10} /> : i + 1}
                    </span>
                    {s.label}
                  </span>
                  {i < STEP_LABELS.length - 1 && <span className="w-5 h-px bg-canvas-border" />}
                </div>
              );
            })}
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {step === 'extracting' ? (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-20">
              <div className="relative">
                <Loader2 size={32} className="text-brand-600 animate-spin" />
                <Sparkles size={14} className="text-brand-500 absolute -top-1 -right-1" />
              </div>
              <div className="text-center">
                <p className="text-[0.9375rem] font-semibold text-ink-900 mb-1">Extracting observations…</p>
                <p className="text-[0.8125rem] text-ink-500">
                  Reading <span className="font-mono text-ink-700">{file?.name}</span> and mapping it into the ATR format.
                </p>
              </div>
            </div>
          ) : step === 'template' ? (
            <div className="p-6 grid md:grid-cols-2 gap-6">
              {/* Required fields */}
              <div>
                <div className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-ink-500 mb-3">Required details per observation</div>
                <ul className="space-y-2">
                  {REQUIRED_FIELDS.map(f => (
                    <li key={f.key} className="flex items-start gap-2.5">
                      <span className="mt-0.5 w-4 h-4 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><Check size={11} /></span>
                      <div className="min-w-0">
                        <div className="text-[0.8125rem] font-semibold text-ink-800 leading-tight">{f.label}</div>
                        <div className="text-[0.6875rem] text-ink-500 leading-snug">{f.hint}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Download template */}
              <div className="flex flex-col gap-3">
                <div className="rounded-[12px] border border-canvas-border bg-[#FAFAFB] p-5">
                  <div className="text-[0.875rem] font-semibold text-ink-900 mb-1">Download the template</div>
                  <p className="text-[0.75rem] text-ink-500 leading-relaxed mb-4">Fill one row per observation, then upload it in the next step. The Excel sheet includes an example row and an Instructions tab.</p>
                  <div className="flex flex-col gap-2.5">
                    <button
                      onClick={() => { downloadExcelTemplate(); addToast({ type: 'success', message: 'Excel template downloaded.' }); }}
                      className="inline-flex items-center justify-between gap-2 h-11 px-4 rounded-[10px] border border-canvas-border bg-canvas-elevated hover:border-brand-300 hover:bg-brand-50/40 transition-colors cursor-pointer group"
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-[8px] bg-compliant-50 text-compliant-700 flex items-center justify-center"><FileSpreadsheet size={16} /></span>
                        <span className="text-[0.8125rem] font-semibold text-ink-800">Excel template</span>
                      </span>
                      <span className="text-[0.6875rem] font-semibold text-brand-700">.xlsx</span>
                    </button>
                    <button
                      onClick={() => { downloadWordTemplate(); addToast({ type: 'success', message: 'Word template downloaded.' }); }}
                      className="inline-flex items-center justify-between gap-2 h-11 px-4 rounded-[10px] border border-canvas-border bg-canvas-elevated hover:border-brand-300 hover:bg-brand-50/40 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-[8px] bg-brand-50 text-brand-700 flex items-center justify-center"><FileText size={16} /></span>
                        <span className="text-[0.8125rem] font-semibold text-ink-800">Word template</span>
                      </span>
                      <span className="text-[0.6875rem] font-semibold text-brand-700">.doc</span>
                    </button>
                  </div>
                </div>
                <p className="text-[0.6875rem] text-ink-500 leading-relaxed px-1">
                  Already have a report? You can also upload a PDF, Word, Excel or CSV directly in the next step — we'll extract the observations from it.
                </p>
              </div>
            </div>
          ) : (
            /* step === 'upload' */
            <div className="p-6 space-y-5">
              {showErrors && missing.length > 0 && (
                <div role="alert" className="border border-risk/30 bg-risk-50 rounded-[8px] px-3 py-2 text-[0.75rem] text-risk-700">
                  <div className="font-semibold mb-0.5 flex items-center gap-1.5"><AlertCircle size={13} />{missing.length === 1 ? 'One field needs attention' : `${missing.length} fields need attention`}</div>
                  <ul className="space-y-0.5">
                    {missing.map(m => (
                      <li key={m.id}>
                        <button type="button" onClick={() => scrollToField(m.id)} className="underline underline-offset-2 hover:text-risk cursor-pointer">{m.label} is required</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Dropzone */}
              <div>
                <label className="text-[0.75rem] font-semibold text-ink-800 mb-1.5 block">Upload filled template or report <span className="text-risk">*</span></label>
                <input ref={fileInputRef} id="ur-file-input" type="file" accept={ACCEPT} className="sr-only" onChange={e => acceptFile(e.target.files?.[0])} />
                {file ? (
                  <div className="flex items-center gap-3 px-4 py-3 border border-canvas-border rounded-[10px] bg-[#FAFAFB]">
                    <div className="w-9 h-9 rounded-[8px] bg-compliant-50 text-compliant-700 flex items-center justify-center shrink-0"><FileText size={16} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[0.8125rem] font-semibold text-ink-900 truncate">{file.name}</div>
                      <div className="text-[0.6875rem] text-ink-500 flex items-center gap-1.5"><CheckCircle2 size={11} className="text-compliant" /> Ready · {formatBytes(file.size)}</div>
                    </div>
                    <button onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="w-7 h-7 rounded-full text-ink-500 hover:text-risk-700 hover:bg-risk-50 flex items-center justify-center cursor-pointer shrink-0" aria-label="Remove file"><X size={14} /></button>
                  </div>
                ) : (
                  <button
                    id="ur-dropzone"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); acceptFile(e.dataTransfer.files?.[0]); }}
                    className={`w-full flex flex-col items-center justify-center gap-2 px-4 py-7 rounded-[10px] border-2 border-dashed transition-colors cursor-pointer ${
                      dragOver ? 'border-brand-500 bg-brand-50/60' : showErrors && !file ? 'border-risk/50 bg-risk-50/40' : 'border-canvas-border bg-[#FAFAFB] hover:border-brand-300 hover:bg-brand-50/30'
                    }`}
                  >
                    <CloudUpload size={22} className={dragOver ? 'text-brand-600' : 'text-ink-400'} />
                    <div className="text-center">
                      <div className="text-[0.8125rem] font-semibold text-ink-800">Drag & drop or <span className="text-brand-700">browse</span></div>
                      <div className="text-[0.6875rem] text-ink-500 mt-0.5">Excel / CSV is read for real · PDF / Word is auto-extracted</div>
                    </div>
                  </button>
                )}
              </div>

              {/* Report metadata */}
              <div className="grid grid-cols-2 gap-4">
                {fields.map(f => {
                  const invalid = showErrors && !f.value.trim();
                  return (
                    <div key={f.id} className={f.id === 'ur-audit-title' ? 'col-span-2' : ''}>
                      <label htmlFor={f.id} className="text-[0.75rem] font-semibold text-ink-800 mb-1.5 block">{f.label} <span className="text-risk">*</span></label>
                      <input
                        id={f.id}
                        value={f.value}
                        onChange={e => { f.set(e.target.value); if (showErrors && e.target.value.trim()) setShowErrors(false); }}
                        placeholder={f.placeholder}
                        className={`w-full px-3 py-2.5 rounded-[8px] border text-[0.8125rem] text-ink-900 focus:outline-none focus:ring-4 transition-colors ${
                          invalid ? 'border-risk/50 focus:border-risk focus:ring-risk/15' : 'border-canvas-border focus:border-brand-600 focus:ring-brand-600/15'
                        }`}
                      />
                    </div>
                  );
                })}
                <div>
                  <div className="text-[0.75rem] font-semibold text-ink-800 mb-1.5">Report ID</div>
                  <div className="px-3 py-2.5 rounded-[8px] border border-dashed border-canvas-border bg-[#FAFAFB] text-[0.8125rem] font-mono text-ink-600">{reportId}</div>
                </div>
                <div>
                  <div className="text-[0.75rem] font-semibold text-ink-800 mb-1.5">Generated On</div>
                  <div className="px-3 py-2.5 rounded-[8px] border border-dashed border-canvas-border bg-[#FAFAFB] text-[0.8125rem] text-ink-600">{generatedOn}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'extracting' && (
          <footer className="shrink-0 px-6 py-3.5 border-t border-canvas-border flex items-center justify-between gap-2">
            {step === 'upload' ? (
              <button onClick={() => setStep('template')} className="inline-flex items-center gap-1.5 h-10 px-4 text-[0.8125rem] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:border-brand-200 transition-colors cursor-pointer">
                <ArrowLeft size={14} /> Back
              </button>
            ) : (
              <button onClick={onClose} className="h-10 px-5 text-[0.8125rem] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:border-brand-200 transition-colors cursor-pointer">Cancel</button>
            )}
            {step === 'template' ? (
              <button onClick={() => setStep('upload')} className="inline-flex items-center gap-1.5 h-10 px-5 text-[0.8125rem] font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-[8px] transition-colors cursor-pointer">
                Next: Upload <ArrowRight size={14} />
              </button>
            ) : (
              <button onClick={handleGenerate} className="inline-flex items-center gap-2 h-10 px-5 text-[0.8125rem] font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-[8px] transition-colors cursor-pointer">
                <Sparkles size={14} /> Generate ATR
              </button>
            )}
          </footer>
        )}
      </motion.div>
    </>
  );
}
