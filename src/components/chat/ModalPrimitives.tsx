/**
 * Shared modal primitives for AddToDashboardModal & AddToReportModal.
 *
 * Provides:
 *  - useDialogA11y(open, onClose, opts) — focus trap + Escape + autofocus + restore-focus
 *  - ModalShell — overlay + dialog frame with role/aria wired up
 *  - ModalEmptyState — centered illustration + title + description + optional CTA
 *  - ModalErrorBanner — inline error with Retry
 *  - ModalRowSkeleton — shimmer row matching the Dashboard/Report list rows
 *  - ModalSubmitError — footer-aligned inline error with Retry
 *  - ButtonSpinner — small inline spinner for in-flight buttons
 *
 * Accent: 'brand' | 'violet' for parity with WidgetPickerParts.
 */
import { motion } from 'motion/react';
import { AlertOctagon, AlertTriangle, CheckCircle2, Loader2, WifiOff } from 'lucide-react';

type Accent = 'brand' | 'violet';

const ACCENT_BTN: Record<Accent, string> = {
  brand: 'bg-brand-600 hover:bg-brand-700 text-white',
  violet: 'bg-violet-600 hover:bg-violet-700 text-white',
};

const ACCENT_LINK: Record<Accent, string> = {
  brand: 'text-brand-700 hover:text-brand-600',
  violet: 'text-violet-700 hover:text-violet-600',
};

// ─── ModalShell ──────────────────────────────────────────────────────────────

export function ModalShell({
  open, onClose, labelledBy, describedBy, dialogRef, width = 640, children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  describedBy?: string;
  dialogRef: React.RefObject<HTMLDivElement | null>;
  width?: number;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]" onClick={onClose}
        aria-hidden="true"
      />
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
        style={{ width: `min(${width}px, calc(100vw - 24px))` }}
        className="relative max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-canvas-border overflow-hidden flex flex-col motion-reduce:transition-none"
      >
        {children}
      </motion.div>
    </div>
  );
}

// ─── ModalEmptyState ─────────────────────────────────────────────────────────

export function ModalEmptyState({
  icon, title, description, primaryAction, secondaryAction, accent = 'brand',
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  accent?: Accent;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-6" role="status">
      <div className="w-12 h-12 rounded-full bg-paper-50 flex items-center justify-center text-ink-400 mb-3">
        {icon}
      </div>
      <p className="text-[0.8125rem] font-semibold text-ink-800">{title}</p>
      {description && <p className="text-[0.75rem] text-ink-500 mt-1 max-w-[320px]">{description}</p>}
      {(primaryAction || secondaryAction) && (
        <div className="flex items-center gap-2 mt-4">
          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              className={`h-8 px-3 rounded-md text-[0.75rem] font-semibold transition-colors cursor-pointer ${ACCENT_BTN[accent]}`}
            >
              {primaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className={`h-8 px-3 rounded-md text-[0.75rem] font-semibold transition-colors cursor-pointer ${ACCENT_LINK[accent]}`}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ModalErrorBanner ────────────────────────────────────────────────────────

export function ModalErrorBanner({
  message, onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-risk-50 border border-risk/30">
      <AlertOctagon size={14} className="text-risk mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[0.75rem] font-semibold text-risk-700">Couldn’t load</p>
        <p className="text-[0.6875rem] text-risk-700/90 mt-0.5">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-[0.6875rem] font-semibold text-risk-700 hover:text-risk cursor-pointer shrink-0 px-2 py-1 rounded-md hover:bg-risk-50"
        >
          Retry
        </button>
      )}
    </div>
  );
}

// ─── ModalRowSkeleton ────────────────────────────────────────────────────────

export function ModalRowSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-1.5" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-canvas-border bg-paper-50/30">
          <div className="w-8 h-8 rounded-md bg-paper-100 animate-pulse shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="h-2.5 w-1/3 bg-paper-100 rounded animate-pulse" />
            <div className="h-2 w-1/2 bg-paper-100 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── ModalSubmitError ────────────────────────────────────────────────────────

export function ModalSubmitError({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-center gap-1.5 text-[0.6875rem] text-risk-700">
      <AlertTriangle size={12} />
      <span className="truncate">{message}</span>
    </div>
  );
}

// ─── ButtonSpinner ───────────────────────────────────────────────────────────

export function ButtonSpinner() {
  return <Loader2 size={13} className="animate-spin motion-reduce:animate-none" />;
}

// ─── OfflineBanner ───────────────────────────────────────────────────────────

export function OfflineBanner() {
  return (
    <div role="status" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-paper-100 border border-canvas-border text-[0.6875rem] text-ink-700">
      <WifiOff size={13} className="text-ink-500 shrink-0" />
      <span className="truncate">You&rsquo;re offline. Changes will be sent when you reconnect.</span>
    </div>
  );
}

// ─── SuccessPanel ────────────────────────────────────────────────────────────

export function SuccessPanel({
  title, description, primaryAction, secondaryAction, accent = 'brand',
}: {
  title: string;
  description?: string;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  accent?: Accent;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-6" role="status" aria-live="polite">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${
        accent === 'violet' ? 'bg-violet-50 text-violet-700' : 'bg-brand-50 text-brand-700'
      }`}>
        <CheckCircle2 size={22} />
      </div>
      <p className="text-[0.875rem] font-semibold text-ink-800">{title}</p>
      {description && <p className="text-[0.75rem] text-ink-500 mt-1 max-w-[360px]">{description}</p>}
      {(primaryAction || secondaryAction) && (
        <div className="flex items-center gap-2 mt-4">
          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              className={`min-h-[40px] px-3.5 rounded-md text-[0.75rem] font-semibold transition-colors cursor-pointer ${ACCENT_BTN[accent]}`}
            >
              {primaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="min-h-[40px] px-3.5 rounded-md text-[0.75rem] font-semibold text-ink-600 hover:bg-paper-100 transition-colors cursor-pointer"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
