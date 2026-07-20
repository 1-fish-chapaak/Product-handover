import { useState, useRef } from 'react';
import { motion } from 'motion/react';
import {
  FileSpreadsheet, FileText, Download, Check, Upload, Sparkles, ArrowDown, ArrowRight, X, Plus,
  Heading, AlignLeft, ShieldAlert, Lightbulb, Wrench, Paperclip, UserCheck, Tag, Gauge, CalendarClock,
} from 'lucide-react';
import { Button } from '../../../shared/Button';
import { WizardFooter } from '../footerSlot';
import { downloadExcelTemplate, downloadWordTemplate, REQUIRED_FIELDS } from '../../atrTemplate';
import { useToast } from '../../../shared/Toast';

// Smooth, gentle entrance for the picker cards.
const EASE = [0.22, 1, 0.36, 1] as const;

interface FormatCardProps {
  icon: typeof FileSpreadsheet;
  tint: string;
  title: string;
  ext: string;
  blurb: string;
  desc: string;
  recommended?: boolean;
  downloaded: boolean;
  onDownload: () => void;
  delay: number;
  hint: string;
}

function FormatCard({ icon: Icon, tint, title, ext, blurb, desc, recommended, downloaded, onDownload, delay, hint }: FormatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE, delay }}
      className={`relative flex flex-col rounded-lg border bg-canvas-elevated p-5 transition-colors ${downloaded ? 'border-compliant/40' : 'border-canvas-border hover:border-brand-300'}`}
      title={hint}
    >
      {recommended && (
        <span className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-700 text-[0.625rem] font-semibold uppercase tracking-wide px-2 py-0.5">
          <Sparkles size={10} aria-hidden="true" /> Recommended
        </span>
      )}
      <div className="flex items-center gap-3 mb-3">
        <span className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${tint}`}><Icon size={21} aria-hidden="true" /></span>
        <div className="min-w-0">
          <h3 className="text-[0.90625rem] font-semibold text-ink-900 leading-tight">{title}</h3>
          <p className="text-[0.71875rem] text-ink-400 mt-0.5">{blurb}</p>
        </div>
      </div>
      <p className="text-[0.78125rem] text-ink-500 leading-relaxed mb-4 flex-1">{desc}</p>
      <Button
        variant={downloaded || !recommended ? 'outline' : 'primary'}
        size="md"
        shape="md"
        leftIcon={downloaded ? <Check size={15} /> : <Download size={15} />}
        onClick={onDownload}
        className="w-full"
      >
        {downloaded ? 'Downloaded' : `Download ${ext}`}
      </Button>
    </motion.div>
  );
}

// The 10 required columns grouped into the three phases of an observation.
const FIELD_BY_KEY = Object.fromEntries(REQUIRED_FIELDS.map(f => [f.key, f.label]));
const FIELD_ICON: Record<string, typeof Check> = {
  title: Heading, description: AlignLeft, riskSummary: ShieldAlert,
  recommendation: Lightbulb, actionTaken: Wrench, evidence: Paperclip, verification: UserCheck,
  classification: Tag, risk: Gauge, dueDate: CalendarClock,
};
const GUIDE_GROUPS: { label: string; keys: string[] }[] = [
  { label: 'What you found', keys: ['title', 'description', 'riskSummary'] },
  { label: 'How it was handled', keys: ['recommendation', 'actionTaken', 'evidence', 'verification'] },
  { label: 'Rating & timeline', keys: ['classification', 'risk', 'dueDate'] },
];

/** Always-visible "how to fill the template" guidance — required columns grouped
 *  by the phase of an observation. */
function TemplateGuide() {
  return (
    <motion.aside
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
      className="flex flex-col h-full min-h-0 overflow-hidden rounded-lg border border-canvas-border bg-canvas-elevated p-5"
    >
      <h3 className="text-[0.84375rem] font-semibold text-ink-900">How to fill it in</h3>
      <p className="text-[0.71875rem] text-ink-500 leading-snug">One observation per row in Excel, or one table per observation in Word.</p>

      <div className="flex items-center justify-between mt-5 mb-1">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-500">Columns to complete</p>
        <span className="text-[0.65625rem] font-semibold text-ink-400 tabular-nums">{REQUIRED_FIELDS.length}</span>
      </div>

      <div className="flex-1 flex flex-col justify-between gap-y-3 pt-1">
        {GUIDE_GROUPS.map(g => (
          <div key={g.label}>
            <div className="text-[0.71875rem] font-semibold text-ink-500 mb-2">{g.label}</div>
            <ul className="space-y-2">
              {g.keys.map(k => {
                const Icon = FIELD_ICON[k] ?? Check;
                return (
                  <li key={k} className="flex items-start gap-3 text-[0.78125rem] text-ink-700 leading-relaxed">
                    <Icon size={14} className="text-ink-400 shrink-0 mt-0.5" aria-hidden="true" />
                    {FIELD_BY_KEY[k]}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </motion.aside>
  );
}

/** Screen 2A — download the IRAME template, fill offline, upload it back
 *  (+ optional annexures, mirroring the existing-report path). */
export default function Step2aTemplateDownload({ onUpload }: {
  onUpload: (file: File, annexures: File[]) => void;
}) {
  const { addToast } = useToast();
  const [downloaded, setDownloaded] = useState<'excel' | 'word' | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [annexures, setAnnexures] = useState<File[]>([]);
  const templateInputRef = useRef<HTMLInputElement>(null);
  const annexInputRef = useRef<HTMLInputElement>(null);

  const handleExcel = () => { downloadExcelTemplate(); setDownloaded('excel'); addToast({ type: 'success', message: 'Excel template downloaded. Fill one row per observation and upload it back.' }); };
  const handleWord = () => { downloadWordTemplate(); setDownloaded('word'); addToast({ type: 'success', message: 'Word template downloaded. Fill one table per observation and upload it back.' }); };
  const hasDownloaded = downloaded !== null;

  return (
    <div className="grid lg:grid-cols-[320px_1fr] gap-5 lg:gap-6 items-stretch h-full min-h-0">
      {/* Left — always-visible "how to fill" guidance */}
      <TemplateGuide />

      {/* Right — the download → upload flow */}
      <div className="w-full">
        <h2 className="text-[1.0625rem] font-semibold text-ink-900 mb-0.5">Download a template</h2>
        <p className="text-[0.8125rem] text-ink-500 mb-5">Pick a format, fill it offline with one observation per row, then upload it below.</p>

        {/* Step 1 — pick a format */}
        <div className="grid sm:grid-cols-2 gap-4">
          <FormatCard
            icon={FileSpreadsheet}
            tint="bg-compliant-50 text-compliant-700"
            title="Excel Template"
            ext=".xlsx"
            blurb=".xlsx · one row per observation"
            desc="Spreadsheet with one row per observation. Best for clean, structured extraction."
            recommended
            downloaded={downloaded === 'excel'}
            onDownload={handleExcel}
            delay={0.04}
            hint="Best for many observations and structured exception data — extracts most reliably."
          />
          <FormatCard
            icon={FileText}
            tint="bg-evidence-50 text-evidence-700"
            title="Word Template"
            ext=".doc"
            blurb=".doc · one table per observation"
            desc="One table per observation. Best when you write findings as narrative prose."
            downloaded={downloaded === 'word'}
            onDownload={handleWord}
            delay={0.1}
            hint="Best for narrative observations written as prose tables."
          />
        </div>

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
      </div>

      <WizardFooter>
        <div className="flex items-center justify-between gap-4 border-t border-canvas-border bg-canvas-elevated px-6 py-3">
          <p className="text-[0.75rem] text-ink-500">
            {templateFile
              ? <span className="text-compliant-700 font-medium">Ready to extract.</span>
              : 'Upload your filled template to continue.'}
          </p>
          <Button
            variant="primary"
            rightIcon={<ArrowRight size={15} />}
            disabled={!templateFile}
            onClick={() => templateFile && onUpload(templateFile, annexures)}
            title={templateFile ? undefined : 'Upload your filled template to continue.'}
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
