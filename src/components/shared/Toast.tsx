import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, Info, AlertTriangle, AlertOctagon, Loader2, X } from 'lucide-react';

export type ToastType = 'loading' | 'success' | 'info' | 'warning' | 'error';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  action?: { label: string; onClick: () => void };
  /** Secondary action (e.g. Undo) shown to the left of the primary action */
  secondaryAction?: { label: string; onClick: () => void };
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => string;
  updateToast: (id: string, patch: Partial<Omit<Toast, 'id'>>) => void;
}

const ToastContext = createContext<ToastContextType>({ addToast: () => '', updateToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const DISMISS_MS: Record<ToastType, number | null> = {
  loading: null,
  info: 5000,
  success: 5000,
  warning: 8000,
  error: null,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>): string => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => {
      // Dedupe — if a visually identical toast is already on screen (same
      // type + message), skip the new one. Prevents rapid-click spam like
      // a stack of "Opening … in source viewer…" from one button.
      if (prev.some(t => t.type === toast.type && t.message === toast.message)) {
        return prev;
      }
      // Cap at 5 — keeps the bottom-right corner readable even when many
      // distinct actions fire in quick succession.
      const next = [...prev, { ...toast, id }];
      return next.length > 5 ? next.slice(next.length - 5) : next;
    });
    return id;
  }, []);

  // Patch a toast in place — resolves a 'loading' toast into its final
  // 'success' / 'error' state once an async action settles.
  const updateToast = useCallback((id: string, patch: Partial<Omit<Toast, 'id'>>) => {
    setToasts(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, updateToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map(toast => (
            <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  useEffect(() => {
    const ms = DISMISS_MS[toast.type];
    if (ms === null) return;
    const timer = setTimeout(() => onRemove(toast.id), ms);
    return () => clearTimeout(timer);
  }, [toast.id, toast.type, onRemove]);

  const icons = {
    loading: <Loader2 size={16} className="text-brand-600 animate-spin" />,
    success: <CheckCircle size={16} className="text-brand-600" />,
    info: <Info size={16} className="text-evidence" />,
    warning: <AlertTriangle size={16} className="text-mitigated-700" />,
    error: <AlertOctagon size={16} className="text-risk-700" />,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 60 }}
      transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
      className="bg-canvas-elevated border border-canvas-border rounded-xl px-4 py-3 flex items-center gap-3 w-[380px] shadow-md"
    >
      {icons[toast.type]}
      <span className="text-[13px] text-ink-800 flex-1">{toast.message}</span>
      {toast.secondaryAction && (
        <button
          onClick={() => { toast.secondaryAction!.onClick(); onRemove(toast.id); }}
          className="text-[12px] font-semibold text-ink-600 hover:text-ink-800 transition-colors cursor-pointer whitespace-nowrap"
        >
          {toast.secondaryAction.label}
        </button>
      )}
      {toast.action && (
        <button
          onClick={toast.action.onClick}
          className="text-[12px] font-semibold text-brand-700 hover:text-brand-600 transition-colors cursor-pointer whitespace-nowrap"
        >
          {toast.action.label}
        </button>
      )}
      <button onClick={() => onRemove(toast.id)} className="text-ink-500 hover:text-ink-700 p-0.5 cursor-pointer">
        <X size={14} />
      </button>
    </motion.div>
  );
}
