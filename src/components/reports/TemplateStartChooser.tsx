// One-door "Create template" starting-point chooser (Template Studio §3). A single
// entry that offers three ways to begin — blank, seeded from a standard, or from
// an uploaded report — all of which land in the same editor. The chooser only
// decides what the editor is pre-filled with.

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FilePlus2, LayoutTemplate, Upload, ChevronRight, ChevronLeft, FileText } from 'lucide-react';
import Modal from '../shared/Modal';
import { ICON_MAP } from './reportShared';
import type { REPORT_TEMPLATES } from '../../data/mockData';

type Standard = typeof REPORT_TEMPLATES[number];

export default function TemplateStartChooser({ standards, onClose, onBlank, onStandard, onUpload }: {
  standards: Standard[];
  onClose: () => void;
  onBlank: () => void;
  onStandard: (t: Standard) => void;
  onUpload: () => void;
}) {
  const [mode, setMode] = useState<'choose' | 'standard'>('choose');

  const options = [
    { key: 'blank', icon: FilePlus2, title: 'Start blank', desc: 'An empty editor — build the outline yourself.', onClick: onBlank },
    { key: 'standard', icon: LayoutTemplate, title: 'Start from a standard', desc: 'Seed the sections from Internal Audit, SOX or ATR.', onClick: () => setMode('standard') },
    { key: 'upload', icon: Upload, title: 'Upload my report', desc: "We'll read its structure and letterhead to fill the editor.", onClick: onUpload },
  ] as const;

  return (
    <AnimatePresence>
      <Modal
        title="Create template"
        subtitle={mode === 'choose' ? 'How do you want to begin? You can change anything in the editor.' : 'Pick a standard to seed the new template — you can edit everything after.'}
        width="max-w-[560px]"
        onClose={onClose}
        ariaLabel="Create template"
        footer={
          mode === 'standard'
            ? <button type="button" onClick={() => setMode('choose')} className="inline-flex items-center gap-1.5 h-9 pl-2.5 pr-4 rounded-[8px] text-[0.8125rem] font-semibold text-ink-700 hover:bg-paper-50 transition-colors cursor-pointer"><ChevronLeft size={15} /> Back</button>
            : <button type="button" onClick={onClose} className="inline-flex items-center justify-center h-9 px-4 rounded-[8px] text-[0.8125rem] font-semibold text-ink-800 bg-white border border-canvas-border hover:bg-paper-50 transition-colors cursor-pointer">Cancel</button>
        }
      >
        {mode === 'choose' ? (
          <div className="space-y-2.5">
            {options.map((o, i) => (
              <motion.button
                key={o.key}
                type="button"
                onClick={o.onClick}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1], delay: i * 0.05 }}
                className="group w-full flex items-center gap-3.5 rounded-[12px] border border-canvas-border bg-white px-4 py-3.5 text-left transition-all hover:border-brand-300 hover:shadow-[0_2px_10px_rgba(15,8,30,0.06)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
              >
                <span className="shrink-0 w-10 h-10 rounded-[11px] bg-brand-50 text-brand-600 flex items-center justify-center group-hover:bg-brand-100 transition-colors"><o.icon size={19} /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[0.9375rem] font-semibold text-ink-900">{o.title}</span>
                  <span className="block text-[0.8125rem] text-ink-500 mt-0.5">{o.desc}</span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-ink-300 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all" />
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {standards.map((t, i) => {
              const Icon = ICON_MAP[t.icon] || FileText;
              const count = t.sections?.length ?? 0;
              return (
                <motion.button
                  key={t.id}
                  type="button"
                  onClick={() => onStandard(t)}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1], delay: i * 0.04 }}
                  className="group w-full flex items-center gap-3 rounded-[11px] border border-canvas-border bg-white px-3.5 py-3 text-left transition-all hover:border-brand-300 hover:shadow-[0_2px_10px_rgba(15,8,30,0.06)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
                >
                  <span className="shrink-0 w-9 h-9 rounded-[10px] bg-brand-50 text-brand-600 flex items-center justify-center"><Icon size={16} /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[0.875rem] font-semibold text-ink-900 truncate">{t.name}</span>
                    <span className="block text-[0.75rem] text-ink-500 truncate">{t.desc}</span>
                  </span>
                  <span className="shrink-0 text-[0.75rem] text-ink-400 tabular-nums whitespace-nowrap">{count} section{count === 1 ? '' : 's'}</span>
                  <ChevronRight size={16} className="shrink-0 text-ink-300 group-hover:text-brand-600 transition-colors" />
                </motion.button>
              );
            })}
          </div>
        )}
      </Modal>
    </AnimatePresence>
  );
}
