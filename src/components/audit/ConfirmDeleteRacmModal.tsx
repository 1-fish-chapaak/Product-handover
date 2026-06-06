import { useEffect } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../shared/Button';

// ─── Delete-RACM confirmation ────────────────────────────────────────────────
// Centered modal shown before permanently deleting a whole RACM (Risk & Control
// Matrix). Deletion is permanent with no undo, so the copy spells that out and
// the confirm action uses the destructive Button variant. Container structure
// mirrors NewRacmModal (BusinessProcesses.tsx); destructive look mirrors
// ConfirmDeleteRiskModal (RacmListTable.tsx). The parent owns the AnimatePresence
// wrapper, so the exit animation plays when it unmounts this on confirm/cancel.
export default function ConfirmDeleteRacmModal({ racmName, onCancel, onConfirm }: {
  racmName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // Escape closes the modal (treated as a cancel). Cleaned up on unmount.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onCancel}
      />
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[400px] bg-white rounded-2xl shadow-2xl border border-canvas-border p-6"
        role="dialog" aria-modal="true" aria-label="Delete this RACM?"
      >
        <div className="flex items-center gap-2.5 mb-3">
          <div className="p-2 rounded-xl bg-risk-50"><AlertTriangle size={18} className="text-risk-700" /></div>
          <h2 className="text-[17px] font-bold text-ink-900">Delete this RACM?</h2>
        </div>
        <p className="text-[0.8125rem] text-ink-500 leading-relaxed mb-5">
          This permanently deletes <span className="font-semibold text-ink-700">“{racmName}”</span> along with its risk and control mappings. This action is permanent and cannot be undone.
        </p>
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="md" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" size="md" onClick={onConfirm}>Delete</Button>
        </div>
      </motion.div>
    </div>
  );
}
