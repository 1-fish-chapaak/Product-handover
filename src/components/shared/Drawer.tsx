import { useEffect, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

/**
 * Canonical right-side drawer shell for detail / create / edit surfaces.
 * Mirrors the structure used by exceptions/ExceptionDetailDrawer so every
 * drawer across the platform reads the same: dimmed backdrop, slide-in panel,
 * serif header with close, scrollable body, optional sticky footer.
 *
 * Wrap the mount in <AnimatePresence> for the exit animation to play.
 */
interface DrawerProps {
  title: string;
  subtitle?: ReactNode;
  /** Tailwind max-width class for the panel. Defaults to 580px. */
  width?: string;
  onClose: () => void;
  /** Sticky footer action row (usually Cancel + a primary Button). */
  footer?: ReactNode;
  children: ReactNode;
  ariaLabel?: string;
}

export default function Drawer({
  title,
  subtitle,
  width = 'max-w-[580px]',
  onClose,
  footer,
  children,
  ariaLabel,
}: DrawerProps) {
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
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-50"
        onClick={onClose}
      />
      <motion.aside
        initial={{ x: 24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className={`fixed top-0 right-0 bottom-0 w-full ${width} bg-canvas-elevated shadow-xl border-l border-canvas-border z-[60] flex flex-col`}
        role="dialog"
        aria-label={ariaLabel ?? title}
      >
        <header className="shrink-0 px-7 pt-7 pb-5 flex items-start justify-between gap-4 border-b border-canvas-border">
          <div className="min-w-0">
            <h2 className="text-[1.5rem] leading-[1.2] font-semibold text-ink-900 tracking-tight">
              {title}
            </h2>
            {subtitle && <p className="text-[0.8125rem] text-ink-500 mt-1 leading-snug">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-md text-ink-500 hover:text-ink-800 hover:bg-canvas flex items-center justify-center cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-7 py-6">{children}</div>

        {footer && (
          <footer className="shrink-0 px-7 py-4 border-t border-canvas-border flex items-center justify-end gap-2">
            {footer}
          </footer>
        )}
      </motion.aside>
    </>
  );
}
