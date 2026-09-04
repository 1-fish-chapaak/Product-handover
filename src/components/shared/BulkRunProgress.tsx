import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp, X, FileText, LayersPlus, Check } from 'lucide-react';
import { useToast } from './Toast';
import { GENERATED_REPORTS_KEY } from '../../data/mockData';

type BulkRunWorkflow = { id: string; name: string; businessProcess?: string };

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

    // Brief "Complete" pause so users see all green checkmarks before the
    // overlay swaps out for the success toast.
    const tid = setTimeout(() => {
      const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      // Build mock workflow results for the demo so the report has body
      // content. Severity rotates High/Medium/Low so users see all three
      // states in a single run.
      const severities: Array<'High' | 'Medium' | 'Low'> = ['High', 'Medium', 'Low'];
      const workflowResults = run.workflows.map((w, i) => {
        const displayId = `WF-${String(i + 1).padStart(3, '0')}`;

        // Demo: simulate failed runs at fixed indices so the "failed runs
        // excluded from this report" behavior is visible. A run with ≥3
        // workflows shows at least one failure; ≥6 shows two.
        if (i === 2 || i === 5) {
          return {
            id: `wfr-${run.id}-${i}`,
            workflowId: displayId,
            name: w.name,
            businessProcess: w.businessProcess,
            severity: 'Low' as const,
            findings: [],
            observations: [],
            runStatus: 'failed' as const,
            failureReason: (i === 2 ? 'errored' : 'skipped') as 'errored' | 'skipped',
          };
        }

        const severity = severities[i % 3];
        return {
          id: `wfr-${run.id}-${i}`,
          workflowId: displayId,
          name: w.name,
          businessProcess: w.businessProcess,
          severity,
          riskOwner: undefined,
          findings: [
            `Detected ${12 + i * 3} anomalies in ${w.businessProcess ?? 'the dataset'} across the analysis window.`,
            `${5 + i} records breached the configured threshold and require review.`,
          ],
          observations: [
            `Data coverage was complete across the supplied files; no schema gaps were detected.`,
            `Top contributors concentrated in ${i % 2 === 0 ? 'the last fortnight' : 'the first week'} of the period.`,
          ],
          outputTable: {
            columns: ['Record ID', 'Entity', 'Flag', 'Amount', 'Date'],
            rows: Array.from({ length: 5 }).map((_, r) => [
              `${displayId}-${String(r + 1).padStart(3, '0')}`,
              `Vendor ${String.fromCharCode(65 + ((i + r) % 12))}-${r + 1}`,
              severity,
              `₹${((i + 1) * (r + 1) * 12500).toLocaleString('en-IN')}`,
              `${String(r + 3).padStart(2, '0')} ${['Jan', 'Feb', 'Mar', 'Apr', 'May'][i % 5]}`,
            ]),
          },
        };
      });

      const newReport = {
        id: `gr-bulk-${Date.now()}`,
        templateId: 'rt-internal-audit',
        name: `${run.name} — Bulk Audit Report`,
        tag: 'Bulk Audit',
        generatedBy: 'AI Copilot',
        generatedAt: today,
        status: 'final',
        pages: 18,
        queries: run.workflows.length,
        workflowResults,
      };

      // Persist so ReportsView picks it up on next mount even if it isn't
      // currently rendered.
      try {
        const key = GENERATED_REPORTS_KEY;
        const raw = localStorage.getItem(key);
        const arr = raw ? JSON.parse(raw) : [];
        if (Array.isArray(arr) && !arr.some((r: { id: string }) => r.id === newReport.id)) {
          localStorage.setItem(key, JSON.stringify([newReport, ...arr]));
        }
      } catch { /* ignore */ }

      // Hot-update ReportsView if it is already mounted.
      window.dispatchEvent(new CustomEvent('irame:bulk-report-created', { detail: newReport }));

      // Swap overlay → success toast with an Open-report action.
      setRun(null);
      addToast({
        type: 'success',
        message: `Audit ran successfully. ${newReport.name} generated.`,
        action: {
          label: 'Open report',
          onClick: () => {
            window.dispatchEvent(new CustomEvent('irame:open-report', { detail: { id: newReport.id } }));
          },
        },
      });
    }, 800);

    return () => clearTimeout(tid);
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
                <span className="text-[0.875rem] font-semibold text-text truncate">
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
                    <div key={w.id} className="flex items-start gap-2.5">
                      <LayersPlus size={15} className="text-primary shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[0.75rem] text-text truncate">{w.name}</div>
                        {w.businessProcess && (
                          <div className="text-[0.75rem] text-text-muted mt-0.5 truncate">{w.businessProcess}</div>
                        )}
                      </div>
                      <div className="mt-0.5 shrink-0">
                        {isComplete ? (
                          <span className="w-4 h-4 rounded-full bg-compliant text-white flex items-center justify-center">
                            <Check size={10} strokeWidth={3} />
                          </span>
                        ) : (
                          <BulkSpinner />
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-2.5 pt-0.5">
                    <FileText size={15} className="text-text-muted shrink-0" />
                    <span className="flex-1 text-[0.75rem] text-text">Generating Report</span>
                    {isComplete && (
                      <span className="w-4 h-4 rounded-full bg-compliant text-white flex items-center justify-center shrink-0">
                        <Check size={10} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                </div>

                <div className="border-t border-border-light px-4 py-3 flex items-center gap-3">
                  <span className="text-[0.75rem] text-text-muted shrink-0">
                    {isComplete ? 'Complete' : 'Processing'}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${isComplete ? 'bg-compliant' : 'bg-primary'}`}
                      style={{ width: `${run.progress}%` }}
                    />
                  </div>
                  <span className="text-[0.75rem] font-mono font-semibold text-text shrink-0 tabular-nums w-9 text-right">
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
