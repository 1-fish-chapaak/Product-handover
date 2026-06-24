import { useState } from 'react';
import { motion } from 'motion/react';
import {
  FileSpreadsheet, FileText, Download, Check, Upload, Sparkles, ArrowDown,
  Heading, AlignLeft, ShieldAlert, Lightbulb, Wrench, Paperclip, UserCheck, Tag, Gauge, CalendarClock,
} from 'lucide-react';
import { Button } from '../../../shared/Button';
import UploadDataModal from '../../../concierge-workflow-builder/UploadDataModal';
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
      className={`relative flex flex-col rounded-[14px] border bg-canvas-elevated p-5 transition-colors ${downloaded ? 'border-compliant/40' : 'border-canvas-border hover:border-brand-300'}`}
      title={hint}
    >
      {recommended && (
        <span className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-700 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5">
          <Sparkles size={10} aria-hidden="true" /> Recommended
        </span>
      )}
      <div className="flex items-center gap-3 mb-3">
        <span className={`w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0 ${tint}`}><Icon size={21} aria-hidden="true" /></span>
        <div className="min-w-0">
          <h3 className="text-[14.5px] font-semibold text-ink-900 leading-tight">{title}</h3>
          <p className="text-[11.5px] text-ink-400 mt-0.5">{blurb}</p>
        </div>
      </div>
      <p className="text-[12.5px] text-ink-500 leading-relaxed mb-4 flex-1">{desc}</p>
      <Button
        variant={downloaded || !recommended ? 'outline' : 'primary'}
        size="md"
        leftIcon={downloaded ? <Check size={15} /> : <Download size={15} />}
        onClick={onDownload}
        className="w-full"
      >
        {downloaded ? 'Downloaded' : `Download ${ext}`}
      </Button>
    </motion.div>
  );
}

// The 10 required columns grouped into the three phases of an observation —
// gives the list meaning and rhythm instead of a flat wall of fields.
const FIELD_BY_KEY = Object.fromEntries(REQUIRED_FIELDS.map(f => [f.key, f.label]));
// A meaningful icon per column so the list reads as "what to write" rather than
// a row of identical ticks.
const FIELD_ICON: Record<string, typeof Check> = {
  title: Heading,
  description: AlignLeft,
  riskSummary: ShieldAlert,
  recommendation: Lightbulb,
  actionTaken: Wrench,
  evidence: Paperclip,
  verification: UserCheck,
  classification: Tag,
  risk: Gauge,
  dueDate: CalendarClock,
};
const GUIDE_GROUPS: { label: string; keys: string[] }[] = [
  { label: 'What you found', keys: ['title', 'description', 'riskSummary'] },
  { label: 'How it was handled', keys: ['recommendation', 'actionTaken', 'evidence', 'verification'] },
  { label: 'Rating & timeline', keys: ['classification', 'risk', 'dueDate'] },
];

/** Always-visible "how to fill the template" guidance — required columns grouped
 *  by the phase of an observation, distributed to fill the column height. */
function TemplateGuide() {
  return (
    <motion.aside
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
      className="flex flex-col h-full min-h-0 overflow-hidden rounded-[14px] border border-canvas-border bg-canvas-elevated p-5"
    >
      <h3 className="text-[13.5px] font-semibold text-ink-900">How to fill it in</h3>
      <p className="text-[11.5px] text-ink-500 leading-snug">One observation per row in Excel, or one table per observation in Word.</p>

      <div className="flex items-center justify-between mt-5 mb-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Columns to complete</p>
        <span className="text-[10.5px] font-semibold text-ink-400 tabular-nums">{REQUIRED_FIELDS.length}</span>
      </div>

      {/* Three groups. justify-between owns the whitespace between groups — it
          expands to fill a tall modal and collapses on a short one, so the list
          breathes when there's room but never clips when there isn't. gap-y is
          the floor; per-item spacing is a small fixed minimum. */}
      <div className="flex-1 flex flex-col justify-between gap-y-3 pt-1">
        {GUIDE_GROUPS.map(g => (
          <div key={g.label}>
            <div className="text-[11.5px] font-semibold text-ink-500 mb-2">{g.label}</div>
            <ul className="space-y-2">
              {g.keys.map(k => {
                const Icon = FIELD_ICON[k] ?? Check;
                return (
                  <li key={k} className="flex items-start gap-3 text-[12.5px] text-ink-700 leading-relaxed">
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

/** Screen 2A — download the IRAME template, fill offline, upload it back. */
export default function Step2aTemplateDownload({ onUpload }: {
  onUpload: (file: File) => void;
}) {
  const { addToast } = useToast();
  const [downloaded, setDownloaded] = useState<'excel' | 'word' | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

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

        {/* Step 2 — upload the filled template */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE, delay: 0.16 }}
          className="rounded-[14px] border border-canvas-border bg-brand-50/30 p-4"
        >
          <h3 className="text-[14px] font-semibold text-ink-900 mb-1">Upload filled template</h3>
          <p className="text-[12px] text-ink-500 mb-3">
            {hasDownloaded ? 'Filled it in? Upload it here — we’ll extract every observation.' : 'Once you’ve filled a template, upload it here — we’ll extract every observation.'}
          </p>
          <Button variant="primary" size="md" leftIcon={<Upload size={15} />} onClick={() => setUploadOpen(true)} className="w-full">
            Upload filled template
          </Button>

          <UploadDataModal
            open={uploadOpen}
            onClose={() => setUploadOpen(false)}
            title="Upload filled template"
            allowedTabs={['upload', 'all', 'files', 'folder']}
            hideSessionFiles
            footerHint="Upload the template you filled — we'll extract every observation."
            onAttachDraft={({ files }) => { const f = files.find(x => x.file)?.file; if (f) onUpload(f); }}
          />
        </motion.div>
      </div>
    </div>
  );
}
