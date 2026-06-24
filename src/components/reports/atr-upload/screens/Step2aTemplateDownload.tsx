import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { FileSpreadsheet, FileText, Download, HelpCircle, Check } from 'lucide-react';
import Modal from '../../../shared/Modal';
import { Button } from '../../../shared/Button';
import FileDropZone from '../components/FileDropZone';
import { downloadExcelTemplate, downloadWordTemplate, REQUIRED_FIELDS } from '../../atrTemplate';
import { useToast } from '../../../shared/Toast';

// A tiny stylised preview of the template layout (rows of field cells).
function TemplateThumb({ accent }: { accent: 'excel' | 'word' }) {
  return (
    <div className="rounded-[8px] border border-canvas-border bg-canvas overflow-hidden mb-4 select-none" aria-hidden="true">
      <div className={`h-1.5 ${accent === 'excel' ? 'bg-compliant' : 'bg-evidence'}`} />
      <div className="p-2.5 space-y-1.5">
        {[0, 1, 2, 3].map(r => (
          <div key={r} className="flex gap-1.5">
            <div className="h-2.5 w-1/3 rounded-[3px] bg-brand-100" />
            <div className="h-2.5 flex-1 rounded-[3px] bg-canvas-border" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Screen 2A — download the IRAME template, fill offline, upload it back. */
export default function Step2aTemplateDownload({ onBack, onUpload }: {
  onBack: () => void;
  onUpload: (file: File) => void;
}) {
  const { addToast } = useToast();
  const [helpOpen, setHelpOpen] = useState(false);
  const [downloaded, setDownloaded] = useState<'excel' | 'word' | null>(null);

  const handleExcel = () => { downloadExcelTemplate(); setDownloaded('excel'); addToast({ type: 'success', message: 'Excel template downloaded. Fill one row per observation and upload it back.' }); };
  const handleWord = () => { downloadWordTemplate(); setDownloaded('word'); addToast({ type: 'success', message: 'Word template downloaded. Fill one table per observation and upload it back.' }); };

  return (
    <div className="max-w-[680px] mx-auto">
      <h2 className="text-[1rem] font-semibold text-ink-900 mb-1 text-center">Download a template</h2>
      <p className="text-[12.5px] text-ink-500 mb-5 text-center">Pick a format, fill it offline with one observation per row, then upload it below.</p>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        {/* Excel */}
        <div className="rounded-[12px] border border-canvas-border bg-canvas-elevated p-5" title="Best for many observations and structured exception data — extracts most reliably.">
          <TemplateThumb accent="excel" />
          <div className="flex items-center gap-2 mb-1">
            <FileSpreadsheet size={16} className="text-compliant-700" aria-hidden="true" />
            <h3 className="text-[14px] font-semibold text-ink-900">Excel Template</h3>
          </div>
          <p className="text-[12px] text-ink-500 mb-4">Spreadsheet with one row per observation. Best for clean, structured extraction.</p>
          <Button variant={downloaded === 'excel' ? 'outline' : 'primary'} size="md" leftIcon={downloaded === 'excel' ? <Check size={15} /> : <Download size={15} />} onClick={handleExcel} className="w-full">
            {downloaded === 'excel' ? 'Downloaded' : 'Download .xlsx'}
          </Button>
        </div>
        {/* Word */}
        <div className="rounded-[12px] border border-canvas-border bg-canvas-elevated p-5" title="Best for narrative observations written as prose tables.">
          <TemplateThumb accent="word" />
          <div className="flex items-center gap-2 mb-1">
            <FileText size={16} className="text-evidence" aria-hidden="true" />
            <h3 className="text-[14px] font-semibold text-ink-900">Word Template</h3>
          </div>
          <p className="text-[12px] text-ink-500 mb-4">One table per observation. Best when you write findings as narrative prose.</p>
          <Button variant={downloaded === 'word' ? 'outline' : 'primary'} size="md" leftIcon={downloaded === 'word' ? <Check size={15} /> : <Download size={15} />} onClick={handleWord} className="w-full">
            {downloaded === 'word' ? 'Downloaded' : 'Download .doc'}
          </Button>
        </div>
      </div>

      {/* Persistent upload-filled zone */}
      <div className="rounded-[12px] border border-canvas-border bg-canvas px-5 py-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-[14px] font-semibold text-ink-900">Upload Filled Template</h3>
          <button onClick={() => setHelpOpen(true)} className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-700 hover:underline cursor-pointer">
            <HelpCircle size={13} aria-hidden="true" /> Need help?
          </button>
        </div>
        <FileDropZone
          label="Upload your filled template"
          acceptExt={['xlsx', 'docx']}
          hint="the template you just downloaded"
          files={[]}
          onFiles={files => { if (files[0]) onUpload(files[0]); }}
        />
      </div>

      <AnimatePresence>
        {helpOpen && (
          <Modal
            title="How to fill the template"
            subtitle="One observation per row (Excel) or per table (Word)."
            width="max-w-[640px]"
            onClose={() => setHelpOpen(false)}
            footer={<Button variant="primary" onClick={() => setHelpOpen(false)}>Got it</Button>}
          >
            <div className="space-y-4">
              <div className="rounded-[8px] border border-canvas-border overflow-hidden" aria-hidden="true">
                <div className="bg-brand-50/60 px-3 py-2 text-[11px] font-semibold text-ink-600 grid grid-cols-3 gap-2">
                  <span>Observation Title</span><span>Risk Significance</span><span>Classification Status</span>
                </div>
                {['Vendor Master Management', 'Three-Way Match Bypass', 'Freight Rate Approval Gap'].map((t, i) => (
                  <div key={t} className="px-3 py-2 text-[11.5px] text-ink-700 grid grid-cols-3 gap-2 border-t border-canvas-border">
                    <span className="truncate">{t}</span>
                    <span>{['High', 'Medium', 'High'][i]}</span>
                    <span className="truncate">{['System Deficiency', 'Procedural Non-Compliance', 'Design Deficiency'][i]}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[12.5px] font-semibold text-ink-800 mb-1.5">Required columns</p>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {REQUIRED_FIELDS.map(f => (
                    <li key={f.key} className="flex items-start gap-1.5 text-[12px] text-ink-600">
                      <Check size={13} className="text-compliant-700 mt-0.5 shrink-0" aria-hidden="true" />
                      {f.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
