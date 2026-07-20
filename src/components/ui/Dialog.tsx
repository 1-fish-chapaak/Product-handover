import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

type Size = 'sm' | 'md' | 'lg';

interface Props {
  open: boolean;
  onClose: () => void;
  size?: Size;
  title?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  hideCloseButton?: boolean;
}

const SIZES: Record<Size, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export default function Dialog({
  open,
  onClose,
  size = 'md',
  title,
  description,
  footer,
  children,
  className,
  hideCloseButton,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(15, 8, 30, 0.5)' }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            className={cn(
              'relative w-full bg-canvas-elevated border border-canvas-border rounded-xl overflow-hidden',
              'shadow-[0_18px_48px_-18px_rgba(15,8,30,0.25)]',
              SIZES[size],
              className,
            )}
          >
            {(title || !hideCloseButton) && (
              <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
                <div className="min-w-0">
                  {title && (
                    <h2 className="text-base font-semibold text-ink-800 leading-tight">{title}</h2>
                  )}
                  {description && (
                    <p className="mt-1 text-[0.8125rem] text-ink-500 leading-relaxed">{description}</p>
                  )}
                </div>
                {!hideCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md text-ink-400 hover:bg-canvas hover:text-ink-700 transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            )}
            <div className="px-5 pb-5">{children}</div>
            {footer && (
              <div className="px-5 pb-5 pt-2 border-t border-canvas-border bg-canvas-elevated flex items-center justify-end gap-2">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
