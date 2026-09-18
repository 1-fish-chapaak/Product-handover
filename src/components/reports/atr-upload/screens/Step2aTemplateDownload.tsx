import { useState, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  FileSpreadsheet, FileText, Download, Check, Upload, Sparkles, ArrowDown, ArrowRight, X, Plus, ChevronDown,
} from 'lucide-react';
import { Button } from '../../../shared/Button';
import { WizardFooter } from '../footerSlot';
import { downloadExcelTemplate, downloadWordTemplate } from '../../atrTemplate';
import { useToast } from '../../../shared/Toast';
import ReportDetailsForm, { type ReportDetailsValue } from '../components/ReportDetailsForm';
import { stripExt } from '../reportFields';
import type { ReportMeta } from '../types';

// Smooth, gentle entrance for the picker cards.
const EASE = [0.22, 1, 0.36, 1] as const;

type TemplateFormat = 'excel' | 'word';

// The two template formats offered by the Download dropdown.
const FORMATS: { id: TemplateFormat; icon: typeof FileSpreadsheet; tint: string; title: string; ext: string; desc: string; recommended?: boolean }[] = [
  { id: 'excel', icon: FileSpreadsheet, tint: 'bg-compliant-50 text-compliant-700', title: 'Excel template', ext: '.xlsx', desc: 'One row per observation. Best for clean, structured extraction.', recommended: true },
  { id: 'word',  icon: FileText,        tint: 'bg-evidence-50 text-evidence-700',   title: 'Word template',  ext: '.doc',  desc: 'One table per observation. Best for findings written as narrative prose.' },
];

/** One "Download a template" CTA — opens a dropdown asking Excel or Word. */
function DownloadTemplateMenu({ downloaded, onPick }: {
  downloaded: TemplateFormat | null;
  onPick: (f: TemplateFormat) => void;
}) {
  const [open, setOpen] = useState(false);
  const picked = FORMATS.find(f => f.id === downloaded);
  return (
    <div className="relative inline-block">
      <Button
        variant={downloaded ? 'outline' : 'primary'}
        size="md"
        shape="md"
        leftIcon={downloaded ? <Check size={15} /> : <Download size={15} />}
        rightIcon={<ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} />}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {picked ? `${picked.title} downloaded` : 'Download a template'}
      </Button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              role="menu"
              aria-label="Template format"
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: EASE }}
              className="absolute right-0 top-full mt-2 w-[340px] z-20 rounded-lg border border-canvas-border bg-canvas-elevated shadow-xl overflow-hidden p-1.5"
            >
              {FORMATS.map(f => {
                const Icon = f.icon;
                const isPicked = downloaded === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="menuitem"
                    onClick={() => { onPick(f.id); setOpen(false); }}
                    className="w-full flex items-start gap-3 rounded-md px-2.5 py-2.5 text-left hover:bg-canvas cursor-pointer transition-colors"
                  >
                    <span className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${f.tint}`}><Icon size={17} aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-[0.8125rem] font-semibold text-ink-900">{f.title}</span>
                        <span className="text-[0.6875rem] text-ink-400">{f.ext}</span>
                        {f.recommended && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-700 text-[0.5625rem] font-semibold uppercase tracking-wide px-1.5 py-0.5">
                            <Sparkles size={9} aria-hidden="true" /> Recommended
                          </span>
                        )}
                      </span>
                      <span className="block text-[0.71875rem] text-ink-500 leading-snug mt-0.5">{f.desc}</span>
                    </span>
                    {isPicked && <Check size={15} className="text-compliant-700 shrink-0 mt-2" aria-hidden="true" />}
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}


/** Screen 2A — download the IRAME template, fill offline, upload it back
 *  (+ optional annexures, mirroring the existing-report path). */
export default function Step2aTemplateDownload({ onUpload }: {
  onUpload: (file: File, annexures: File[], meta: Partial<ReportMeta>) => void;
}) {
  const { addToast } = useToast();
  const [downloaded, setDownloaded] = useState<TemplateFormat | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [annexures, setAnnexures] = useState<File[]>([]);
  // Cover details + validity, tracked from the shared form (same as the report path).
  const [details, setDetails] = useState<ReportDetailsValue>({ meta: {}, complete: false, duplicate: false, outstanding: [] });
  const templateInputRef = useRef<HTMLInputElement>(null);
  const annexInputRef = useRef<HTMLInputElement>(null);

  const handleDownload = (f: TemplateFormat) => {
    if (f === 'excel') { downloadExcelTemplate(); addToast({ type: 'success', message: 'Excel template downloaded. Fill one row per observation and upload it back.' }); }
    else { downloadWordTemplate(); addToast({ type: 'success', message: 'Word template downloaded. Fill one table per observation and upload it back.' }); }
    setDownloaded(f);
  };
  const hasDownloaded = downloaded !== null;

  const ready = !!templateFile && details.complete && !details.duplicate;

  const outstanding = [templateFile ? null : 'the filled template', ...details.outstanding].filter((x): x is string => x !== null);
  const outstandingLine = details.duplicate
    ? `Report Number ${details.meta.reportNumber} is already used in ${details.meta.section} for ${details.meta.financialYear}. Enter a unique number.`
    : outstanding.length === 1
      ? `Add ${outstanding[0]} to continue.`
      : `Still needed: ${outstanding.slice(0, -1).join(', ')} and ${outstanding[outstanding.length - 1]}.`;

  return (
    <div className="w-full">
      {/* The download → upload flow */}
      <div className="w-full">
        {/* Step 1 — download the template (the dropdown asks Excel or Word) */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE, delay: 0.04 }}
          className={`flex items-center gap-4 flex-wrap rounded-lg border bg-canvas-elevated p-4 transition-colors ${hasDownloaded ? 'border-compliant/40' : 'border-canvas-border'}`}
        >
          <span className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-brand-50 text-brand-700"><Download size={19} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[0.875rem] font-semibold text-ink-900 leading-tight">Download a template</h3>
            <p className="text-[0.71875rem] text-ink-500 mt-0.5">
              {hasDownloaded
                ? `Fill the ${downloaded === 'excel' ? 'spreadsheet (one row per observation)' : 'document (one table per observation)'}, then upload it below.`
                : 'Choose Excel (one row per observation) or Word (one table per observation).'}
            </p>
          </div>
          <DownloadTemplateMenu downloaded={downloaded} onPick={handleDownload} />
        </motion.div>

        {/* Connector — guides the eye from download to upload */}
        <div className="flex items-center gap-3 my-4" aria-hidden="true">
          <div className="flex-1 h-px bg-canvas-border" />
          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full transition-colors ${hasDownloaded ? 'bg-brand-600 text-white' : 'bg-draft-50 text-ink-400'}`}><ArrowDown size={13} /></span>
          <div className="flex-1 h-px bg-canvas-border" />
        </div>

        {/* Step 2 — upload the filled template (+ optional annexures) */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE, delay: 0.16 }}
          className="grid sm:grid-cols-2 gap-4 items-start"
        >
          {/* Filled template (required) */}
          <div className={`relative flex flex-col rounded-lg border bg-canvas-elevated p-4 transition-colors ${templateFile ? 'border-compliant/40' : 'border-canvas-border hover:border-brand-300'}`}>
            <span className="absolute top-3.5 right-3.5 inline-flex items-center rounded-full text-[0.625rem] font-semibold uppercase tracking-wide px-2 py-0.5 bg-risk-50 text-risk-700">Required</span>
            <div className="flex items-center gap-3 mb-3 pr-20">
              <span className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-brand-50 text-brand-700"><FileText size={19} aria-hidden="true" /></span>
              <div className="min-w-0">
                <h3 className="text-[0.875rem] font-semibold text-ink-900 leading-tight">Filled template</h3>
                <p className="text-[0.71875rem] text-ink-400 mt-0.5 truncate">The IRAME .xlsx / .doc you filled in</p>
              </div>
            </div>
            {templateFile && (
              <div className="mb-3 flex items-center gap-2.5 rounded-md border border-canvas-border bg-canvas px-2.5 py-1.5">
                <span className="w-6 h-6 rounded-sm bg-compliant-50 text-compliant-700 flex items-center justify-center shrink-0"><FileText size={13} aria-hidden="true" /></span>
                <span className="text-[0.75rem] font-medium text-ink-800 truncate flex-1">{templateFile.name}</span>
                <button type="button" onClick={() => setTemplateFile(null)} aria-label="Remove template" className="w-5 h-5 inline-flex items-center justify-center rounded-full text-ink-400 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer shrink-0"><X size={12} aria-hidden="true" /></button>
              </div>
            )}
            <Button variant={templateFile ? 'outline' : 'primary'} size="md" shape="md" leftIcon={templateFile ? <Plus size={15} /> : <Upload size={15} />} onClick={() => templateInputRef.current?.click()} className="w-full mt-auto">
              {templateFile ? 'Replace file' : 'Upload filled template'}
            </Button>
          </div>

          {/* Annexures (optional) */}
          <div className={`relative flex flex-col rounded-lg border bg-canvas-elevated p-4 transition-colors ${annexures.length > 0 ? 'border-compliant/40' : 'border-canvas-border hover:border-brand-300'}`}>
            <span className="absolute top-3.5 right-3.5 inline-flex items-center rounded-full text-[0.625rem] font-semibold uppercase tracking-wide px-2 py-0.5 bg-paper-100 text-ink-500">Optional</span>
            <div className="flex items-center gap-3 mb-3 pr-20">
              <span className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-evidence-50 text-evidence-700"><FileSpreadsheet size={19} aria-hidden="true" /></span>
              <div className="min-w-0">
                <h3 className="text-[0.875rem] font-semibold text-ink-900 leading-tight">Annexures</h3>
                <p className="text-[0.71875rem] text-ink-400 mt-0.5 truncate">.xlsx workbooks · power Manage Exceptions</p>
              </div>
            </div>
            {annexures.length > 0 && (
              <ul className="mb-3 space-y-1.5 max-h-[92px] overflow-y-auto pr-1 -mr-1">
                {annexures.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-2.5 rounded-md border border-canvas-border bg-canvas px-2.5 py-1.5">
                    <span className="w-6 h-6 rounded-sm bg-compliant-50 text-compliant-700 flex items-center justify-center shrink-0"><FileSpreadsheet size={13} aria-hidden="true" /></span>
                    <span className="text-[0.75rem] font-medium text-ink-800 truncate flex-1">{f.name}</span>
                    <button type="button" onClick={() => setAnnexures(prev => prev.filter((_, idx) => idx !== i))} aria-label={`Remove ${f.name}`} className="w-5 h-5 inline-flex items-center justify-center rounded-full text-ink-400 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer shrink-0"><X size={12} aria-hidden="true" /></button>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="outline" size="md" shape="md" leftIcon={annexures.length > 0 ? <Plus size={15} /> : <Upload size={15} />} onClick={() => annexInputRef.current?.click()} className="w-full mt-auto">
              {annexures.length > 0 ? 'Add more files' : 'Upload annexures'}
            </Button>
          </div>
        </motion.div>

        {/* Report details — same shared form as the upload path. */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE, delay: 0.22 }}
          className="mt-4"
        >
          <ReportDetailsForm onChange={setDetails} suggestedReportName={templateFile ? stripExt(templateFile.name) : undefined} intro="These print on the ATR cover. Confirm the classification and cover facts here." />
        </motion.div>
      </div>

      <WizardFooter>
        <div className="flex items-center justify-between gap-4 border-t border-canvas-border bg-canvas-elevated px-6 py-3">
          <p className="text-[0.75rem] text-ink-500">
            {ready
              ? <span className="text-compliant-700 font-medium">Ready to extract.</span>
              : outstandingLine}
          </p>
          <Button
            variant="primary"
            rightIcon={<ArrowRight size={15} />}
            disabled={!ready}
            onClick={() => ready && templateFile && onUpload(templateFile, annexures, details.meta)}
            title={ready ? undefined : outstandingLine}
          >
            Extract from template
          </Button>
        </div>
      </WizardFooter>

      {/* Native OS file pickers — opened directly by the upload buttons above. */}
      <input
        ref={templateInputRef}
        type="file"
        hidden
        accept=".xlsx,.xls,.doc,.docx"
        onChange={e => { const f = e.target.files?.[0]; if (f) setTemplateFile(f); e.currentTarget.value = ''; }}
      />
      <input
        ref={annexInputRef}
        type="file"
        multiple
        hidden
        accept=".xlsx,.xls,.csv"
        onChange={e => { setAnnexures(prev => [...prev, ...Array.from(e.target.files ?? [])]); e.currentTarget.value = ''; }}
      />
    </div>
  );
}
