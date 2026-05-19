import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp, X, FileText, LayersPlus, Check } from 'lucide-react';
import { useToast } from './Toast';

type BulkRunWorkflow = { id: string; name: string };

type BulkRunState = {
  id: string;
  name: string;
  workflows: BulkRunWorkflow[];
  progress: number;
  collapsed: boolean;
};

interface BulkRunProgressContextType {
  startBulkRun: (run: { name: string; workflows: BulkRunWorkflow[] }) => void;
}

const BulkRunProgressContext = createContext<BulkRunProgressContextType>({
  startBulkRun: () => {},
});

export function useBulkRunProgress() {
  return useContext(BulkRunProgressContext);
}

export function BulkRunProgressProvider({ children }: { children: React.ReactNode }) {
  const [run, setRun] = useState<BulkRunState | null>(null);
  const { addToast } = useToast();
  const completedRunsRef = useRef<Set<string>>(new Set());

  const startBulkRun = useCallback((data: { name: string; workflows: BulkRunWorkflow[] }) => {
    setRun({
      id: `bulk-${Date.now()}`,
      name: data.name,
      workflows: data.workflows,
      progress: 0,
      collapsed: false,
    });
  }, []);

  useEffect(() => {
    if (!run || run.progress >= 100) return;
    const id = setInterval(() => {
      setRun(prev => {
        if (!prev) return prev;
        const next = Math.min(100, prev.progress + Math.random() * 5 + 1.5);
        return { ...prev, progress: next };
      });
    }, 700);
    return () => clearInterval(id);
  }, [run?.id, run && run.progress >= 100]);

  useEffect(() => {
    if (!run || run.progress < 100) return;
    if (completedRunsRef.current.has(run.id)) return;
    completedRunsRef.current.add(run.id);
    const today = new Date().toISOString().slice(0, 10);
    const reportName = `${run.name}_${today}_BulkReport.xlsx`;
    addToast({
      type: 'success',
      message: `Audit "${run.name}" completed successfully. ${reportName} is ready.`,
    });
  }, [run?.id, run?.progress, addToast]);

  const setCollapsed = (collapsed: boolean) =>
    setRun(prev => (prev ? { ...prev, collapsed } : prev));
  const close = () => setRun(null);

  const isComplete = run ? run.progress >= 100 : false;

  return (
    <BulkRunProgressContext.Provider value={{ startBulkRun }}>
      {children}
      <AnimatePresence>
        {run && (
          <motion.div
            key={run.id}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            className="fixed bottom-6 right-6 z-[100] w-[400px] rounded-2xl bg-white border border-border-light shadow-xl overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-3">
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className="text-[14px] font-semibold text-text truncate">
                  {run.name} {isComplete ? 'Complete' : 'Running'}
                </span>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isComplete ? 'bg-compliant' : 'bg-primary animate-pulse'}`} />
              </div>
              <button
                type="button"
                onClick={() => setCollapsed(!run.collapsed)}
                className="p-1 text-text-muted hover:text-text rounded-md cursor-pointer transition-colors"
                aria-label={run.collapsed ? 'Expand bulk run progress' : 'Collapse bulk run progress'}
              >
                {run.collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
              </button>
              <button
                type="button"
                onClick={close}
                className="p-1 text-text-muted hover:text-text rounded-md cursor-pointer transition-colors"
                aria-label="Dismiss"
              >
                <X size={15} />
              </button>
            </div>

            {!run.collapsed && (
              <>
                <div className="border-t border-border-light px-4 py-3 space-y-2 max-h-[260px] overflow-y-auto">
                  {run.workflows.map(w => (
                    <div key={w.id} className="flex items-center gap-2.5">
                      <LayersPlus size={15} className="text-primary shrink-0" />
                      <span className="flex-1 text-[12.5px] text-text truncate">{w.name}</span>
                      {isComplete ? (
                        <span className="w-4 h-4 rounded-full bg-compliant text-white flex items-center justify-center shrink-0">
                          <Check size={10} strokeWidth={3} />
                        </span>
                      ) : (
                        <BulkSpinner />
                      )}
                    </div>
                  ))}
                  <div className="flex items-center gap-2.5 pt-0.5">
                    <FileText size={15} className="text-text-muted shrink-0" />
                    <span className="flex-1 text-[12.5px] text-text">Generating Report</span>
                    {isComplete && (
                      <span className="w-4 h-4 rounded-full bg-compliant text-white flex items-center justify-center shrink-0">
                        <Check size={10} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                </div>

                <div className="border-t border-border-light px-4 py-3 flex items-center gap-3">
                  <span className="text-[11.5px] text-text-muted shrink-0">
                    {isComplete ? 'Complete' : 'Processing'}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${isComplete ? 'bg-compliant' : 'bg-primary'}`}
                      style={{ width: `${run.progress}%` }}
                    />
                  </div>
                  <span className="text-[11.5px] font-mono font-semibold text-text shrink-0 tabular-nums w-9 text-right">
                    {Math.round(run.progress)}%
                  </span>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </BulkRunProgressContext.Provider>
  );
}

function BulkSpinner() {
  return (
    <svg
      className="animate-spin shrink-0 text-primary"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
