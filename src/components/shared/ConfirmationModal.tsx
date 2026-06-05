import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Loader2 } from 'lucide-react';

// Reusable destructive/primary confirmation modal. Uses the design-system
// tokens (canvas-elevated surface, ink-900/40 backdrop, risk vs brand) so it
// matches the standard white Modal shell it usually stacks over. Currently
// adopted by Knowledge Hub's source-card Remove/Disconnect flow only —
// existing inline confirms in ControlDetailDrawer / DashboardListPage /
// Sidebar are NOT migrated. Future PRs can move them over;
// this component is the target.

interface Props {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  // 'destructive' tints the confirm button risk-red; 'primary' uses brand.
  tone?: 'destructive' | 'primary';
  pending?: boolean; // shows a spinner on the confirm button
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmationModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  tone         = 'destructive',
  pending      = false,
  onConfirm,
  onClose,
}: Props) {
  const isDestructive = tone === 'destructive';
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-ink-900/40 backdrop-blur-[4px]"
            onClick={pending ? undefined : onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            className="relative bg-canvas-elevated rounded-2xl shadow-xl border border-canvas-border w-full max-w-sm p-5 space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                isDestructive ? 'bg-risk-50 text-risk-700' : 'bg-brand-50 text-brand-700'
              }`}>
                <AlertTriangle size={18} />
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <h3 className="text-[0.875rem] font-semibold text-ink-800">{title}</h3>
                {description && (
                  <p className="text-[0.75rem] text-ink-500 mt-1 leading-relaxed">{description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="px-4 h-9 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] font-semibold text-ink-800 hover:border-brand-200 hover:bg-canvas disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={pending}
                className={`inline-flex items-center gap-1.5 px-4 h-9 rounded-md text-white text-[0.75rem] font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed ${
                  isDestructive
                    ? 'bg-risk hover:bg-risk-700 active:bg-risk-700 disabled:bg-risk/40'
                    : 'bg-brand-600 hover:bg-brand-500 active:bg-brand-800 disabled:bg-brand-600/40'
                }`}
              >
                {pending && <Loader2 size={13} className="animate-spin" />}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
