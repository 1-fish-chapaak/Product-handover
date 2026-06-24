import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../shared/Button';

// Shared "discard work?" confirm for ATR surfaces — the upload wizard's close
// guard and the library ATR editor's leave guard render the SAME dialog so the
// two flows look identical. Full-viewport, portaled to <body> so `fixed` escapes
// any transformed ancestor and spans the screen, over the platform modal scrim
// (`bg-ink-900/40 backdrop-blur-[2px]`). One scrim only — callers nested inside a
// dimmed modal hide their own backdrop while this is open.
export default function ReportDiscardDialog({ open, title, body, confirmLabel, cancelLabel, onConfirm, onCancel }: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } };
    // Capture so we intercept Escape before any host close handler.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onCancel]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center p-6"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="report-discard-title"
          aria-describedby="report-discard-body"
        >
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            className="relative w-full max-w-md bg-canvas-elevated rounded-md shadow-lg border border-canvas-border p-6"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-risk-50 text-risk-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={16} />
              </div>
              <div className="min-w-0">
                <h2 id="report-discard-title" className="text-lg font-semibold text-ink-900 tracking-tight leading-tight">{title}</h2>
                <p id="report-discard-body" className="mt-1.5 text-sm text-ink-500 leading-relaxed">{body}</p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="outline" size="md" shape="md" className="h-10 px-4" onClick={onCancel} autoFocus>{cancelLabel}</Button>
              <Button variant="destructive" size="md" shape="md" className="h-10 px-4" onClick={onConfirm}>{confirmLabel}</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
