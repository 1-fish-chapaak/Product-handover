// Upload-a-document → report-template modal. Converts a .docx/.pdf/.xlsx into a
// custom template by detecting its section headings. Extracted from ReportsView
// (it has a clean onClose/onSave interface and no report-view coupling).

import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Upload, X, FileText, CheckCircle2, Sparkles } from 'lucide-react';
import { useToast } from '../shared/Toast';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { REPORT_TEMPLATES } from '../../data/mockData';

export default function UploadTemplateModal({ onClose, onSave }: { onClose: () => void; onSave?: (t: typeof REPORT_TEMPLATES[number]) => void }) {
  const { addToast } = useToast();
  const [step, setStep] = useState<'upload' | 'selected' | 'converting' | 'converted'>('upload');
  const [templateName, setTemplateName] = useState('SOX Report Template');
  const [pickedFile, setPickedFile] = useState<{ name: string; size: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, true, onClose);

  // The `accept` attribute is only a dialog hint (users can pick "All files",
  // and it doesn't cover drag-drop), so enforce the supported formats here
  // before anything advances to the AI conversion step.
  const ALLOWED_EXT = ['docx', 'pdf', 'xlsx'];
  const handleFilePicked = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXT.includes(ext)) {
      addToast({ type: 'error', message: `Unsupported file type${ext ? ` ".${ext}"` : ''}. Upload a .docx, .pdf, or .xlsx file.` });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    const sizeMb = file.size >= 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.round(file.size / 1024))} KB`;
    setPickedFile({ name: file.name, size: sizeMb });
    // Prettify the filename into a template-name suggestion.
    const base = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    if (base) setTemplateName(base.replace(/\b\w/g, c => c.toUpperCase()));
    setStep('selected');
  };

  const DETECTED_SECTIONS = [
    'Executive Summary', 'Findings', 'Risk Assessment',
    'Control Testing Results', 'Recommendations', 'Appendix'
  ];

  useEffect(() => {
    if (step === 'converting') {
      const timer = setTimeout(() => setStep('converted'), 2000);
      return () => clearTimeout(timer);
    }
  }, [step]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]" />
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        role="dialog" aria-modal="true" aria-label="Upload Template"
        className="relative bg-white rounded-[16px] shadow-xl w-[560px] max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-canvas-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-600/10 text-brand-600 rounded-[8px]"><Upload size={16} /></div>
            <div>
              <h3 className="text-[0.9375rem] font-semibold text-ink-800">Upload Template</h3>
              <p className="text-[0.6875rem] text-ink-400">Convert a document into a report template</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-paper-50 rounded-[8px] transition-colors cursor-pointer"><X size={16} className="text-ink-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Drop Zone */}
          {step === 'upload' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.pdf,.xlsx"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFilePicked(f); }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-canvas-border hover:border-brand-600/40 rounded-[12px] p-10 flex flex-col items-center justify-center gap-3 transition-all duration-300 hover:bg-brand-600/[0.02] cursor-pointer group"
              >
                <div className="p-3 bg-brand-600/5 rounded-[8px] group-hover:bg-brand-600/10 transition-colors">
                  <Upload size={32} className="text-brand-600/50 group-hover:text-brand-600 transition-colors" />
                </div>
                <div className="text-center">
                  <p className="text-[0.8125rem] font-medium text-ink-800">Drop your template file here or click to browse</p>
                  <p className="text-[0.6875rem] text-ink-400 mt-1">Supports .docx, .pdf, .xlsx</p>
                </div>
              </button>
            </motion.div>
          )}

          {/* File Selected */}
          {step === 'selected' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-brand-600/[0.03] border border-brand-600/10 rounded-[12px]">
                <div className="p-2 bg-brand-600/10 rounded-[8px]"><FileText size={20} className="text-brand-600" /></div>
                <div className="flex-1">
                  <p className="text-[0.8125rem] font-semibold text-ink-800">{pickedFile?.name ?? 'SOX_Report_Template.docx'}</p>
                  <p className="text-[0.6875rem] text-ink-400">{pickedFile?.size ?? '2.4 MB'}</p>
                </div>
                <CheckCircle2 size={20} className="text-compliant-700" />
              </div>
              <button
                onClick={() => setStep('converting')}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-600 text-white text-[0.8125rem] font-semibold hover:bg-brand-500 transition-all cursor-pointer rounded-[8px]"
              >
                <Sparkles size={14} /> Convert to Template
              </button>
            </motion.div>
          )}

          {/* Converting Animation */}
          {step === 'converting' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-8 gap-4">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              >
                <Sparkles size={32} className="text-brand-600" />
              </motion.div>
              <div className="text-center">
                <p className="text-[0.875rem] font-semibold text-ink-800">Analyzing document structure...</p>
                <p className="text-[0.6875rem] text-ink-400 mt-1">Detecting sections, headers, and formatting</p>
              </div>
              <div className="w-48 h-1.5 bg-canvas rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 2, ease: 'easeInOut' }}
                />
              </div>
            </motion.div>
          )}

          {/* Conversion Complete */}
          {step === 'converted' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="flex items-center gap-3 p-4 bg-compliant-50 border border-compliant rounded-[12px]">
                <CheckCircle2 size={20} className="text-compliant-700" />
                <div>
                  <p className="text-[0.8125rem] font-semibold text-brand-600">Template converted!</p>
                  <p className="text-[0.6875rem] text-brand-600/70">6 sections detected</p>
                </div>
              </div>

              <div>
                <label className="text-[0.75rem] font-semibold text-ink-800 mb-2 block">Detected Sections</label>
                <div className="space-y-1.5">
                  {DETECTED_SECTIONS.map((section, i) => (
                    <motion.div
                      key={section}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="flex items-center gap-2.5 px-3 py-2 bg-canvas rounded-[8px]"
                    >
                      <div className="w-5 h-5 rounded-[8px] bg-brand-600/10 text-brand-600 flex items-center justify-center text-[0.625rem] font-bold">{i + 1}</div>
                      <span className="text-[0.75rem] text-ink-800 font-medium">{section}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[0.75rem] font-semibold text-ink-800 mb-2 block">Template Name</label>
                <input
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-canvas-border text-[0.8125rem] focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10 rounded-[8px]"
                />
              </div>
            </motion.div>
          )}
        </div>

        {step === 'converted' && (
          <div className="px-6 py-4 border-t border-canvas-border flex justify-end gap-2 shrink-0">
            <button onClick={onClose} className="inline-flex items-center justify-center gap-1.5 h-9 px-5 text-[0.8125rem] font-semibold text-ink-800 bg-white border border-canvas-border hover:bg-paper-50 transition-colors cursor-pointer rounded-[8px]">Cancel</button>
            <button
              onClick={() => {
                const name = templateName.trim();
                if (!name) { addToast({ type: 'error', message: 'Give the template a name before saving.' }); return; }
                if (onSave) {
                  onSave({
                    id: `ct-upload-${Date.now()}`,
                    name,
                    desc: `Converted from ${pickedFile?.name ?? 'uploaded document'} — ${DETECTED_SECTIONS.length} sections detected.`,
                    category: 'Custom',
                    icon: 'file-text',
                    sections: DETECTED_SECTIONS.map(s => ({ name: s, icon: 'file-text' })),
                  } as typeof REPORT_TEMPLATES[number]);
                } else {
                  addToast({ type: 'success', message: `"${name}" saved to template library.` });
                }
                onClose();
              }}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-5 bg-brand-600 text-white text-[0.8125rem] font-semibold hover:bg-brand-500 transition-colors cursor-pointer rounded-[8px]"
            >
              Save Template
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
