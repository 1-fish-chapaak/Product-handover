import { type ReactNode, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { Button } from './Button';

// Reusable confirm dialog — the shadcn AlertDialog layout in our theme:
// a single padded card with a bold title, a muted description, and a
// Cancel + confirm pair bottom-right. No icon, no header rule, no close X.
// Uses design-system tokens (canvas-elevated surface, ink-900/40 backdrop)
// and the shared Button so the action pair inherits the platform focus ring,
// active-scale and disabled tokens. 'destructive' tints the confirm risk-red;
// 'primary' uses brand purple.

interface Props {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'destructive' | 'primary';
  pending?: boolean; // shows a spinner on the confirm button
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmationModal({
  open,
  title,
  description,
  confirmLabel = 'Continue',
  cancelLabel  = 'Cancel',
  tone         = 'destructive',
  pending      = false,
  onConfirm,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pending) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, pending, onClose]);

  const isDestructive = tone === 'destructive';
  const titleId = 'confirmation-modal-title';
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]"
            onClick={pending ? undefined : onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            className="relative bg-canvas-elevated rounded-md shadow-lg border border-canvas-border w-full max-w-lg p-6 min-h-[180px] flex flex-col"
          >
            <h2 id={titleId} className="text-lg font-semibold text-ink-900 tracking-tight">
              {title}
            </h2>
            {description && (
              <div className="mt-2 text-sm text-ink-500">
                {description}
              </div>
            )}
            <div className="mt-auto pt-5 flex items-center justify-end gap-2">
              <Button variant="outline" size="md" shape="md" className="h-10 px-4" disabled={pending} onClick={onClose} autoFocus>
                {cancelLabel}
              </Button>
              <Button
                variant={isDestructive ? 'destructive' : 'primary'}
                size="md"
                shape="md"
                className="h-10 px-4"
                disabled={pending}
                onClick={onConfirm}
                leftIcon={pending ? <Loader2 size={13} className="animate-spin" /> : undefined}
              >
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
