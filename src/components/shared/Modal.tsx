import { useEffect, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

/**
 * Centered modal shell for detail / create / edit surfaces. Same API as the
 * Drawer shell (title, subtitle, width, footer) so callers swap with no other
 * changes — but renders centered over a dimmed backdrop instead of a side panel.
 *
 * Wrap the mount in <AnimatePresence> for the exit animation to play. Mirrors
 * the Drawer's fragment-with-two-motion-children structure so exit propagates.
 */
interface ModalProps {
  title: string;
  subtitle?: ReactNode;
  /** Tailwind max-width class for the panel. Defaults to 560px. */
  width?: string;
  /** Optional fixed-height class (e.g. `h-[662px]`). When set, the panel locks
   *  to a fixed box instead of growing with content. */
  height?: string;
  onClose: () => void;
  /** Sticky footer action row (usually Cancel + a primary button). */
  footer?: ReactNode;
  children: ReactNode;
  ariaLabel?: string;
}

export default function Modal({
  title,
  subtitle,
  width = 'max-w-[560px]',
  height,
  onClose,
  footer,
  children,
  ariaLabel,
}: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-[60]"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 pointer-events-none"
      >
        <div
          className={`pointer-events-auto w-full ${width} ${height ? `${height} max-h-[90vh]` : 'max-h-[85vh]'} bg-canvas-elevated rounded-2xl border border-canvas-border shadow-xl flex flex-col`}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel ?? title}
        >
          <header className={`shrink-0 px-7 ${subtitle ? 'py-3.5' : 'py-3'} flex items-center justify-between gap-4 border-b border-canvas-border`}>
            <div className="min-w-0">
              <h2 className="text-[1.25rem] leading-tight font-semibold text-ink-900 tracking-tight">
                {title}
              </h2>
              {subtitle && <p className="text-[0.8125rem] text-ink-500 mt-0.5 leading-snug">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-md text-ink-500 hover:text-ink-800 hover:bg-canvas flex items-center justify-center cursor-pointer shrink-0"
            >
              <X size={18} />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-7 py-5">{children}</div>

          {footer && (
            <footer className="shrink-0 px-7 py-3 border-t border-canvas-border flex items-center justify-end gap-2">
              {footer}
            </footer>
          )}
        </div>
      </motion.div>
    </>
  );
}
