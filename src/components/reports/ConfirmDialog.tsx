// Small confirm / destructive-confirm dialog used across the Reports surfaces.
// Portal-rendered alertdialog with a focus trap. Extracted from ReportsView —
// no report-view coupling.

import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, open, onClose);
  if (!open) return null;
  const titleId = `confirm-${title.replace(/\s+/g, '-').toLowerCase()}`;
  const descId = `${titleId}-desc`;
  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-6"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]" />
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          className="relative bg-white rounded-[16px] border border-canvas-border shadow-2xl w-[440px] max-w-[calc(100vw-32px)] p-6"
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 w-7 h-7 inline-flex items-center justify-center rounded-[8px] text-ink-400 hover:text-ink-800 hover:bg-paper-50 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
          <h3 id={titleId} className="text-[16px] font-bold text-ink-800 tracking-tight mb-2">{title}</h3>
          <div id={descId} className="text-[13px] text-ink-500 leading-relaxed mb-6 pr-4">{description}</div>
          <div className="flex items-center justify-end gap-2.5">
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-5 text-[13px] font-semibold text-ink-800 bg-white border border-canvas-border rounded-[8px] hover:bg-paper-50 transition-colors cursor-pointer"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={`inline-flex items-center justify-center h-9 px-5 text-[13px] font-semibold text-white rounded-[8px] transition-colors cursor-pointer ${
                destructive ? 'bg-risk hover:bg-risk-700' : 'bg-brand-600 hover:bg-brand-500'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
