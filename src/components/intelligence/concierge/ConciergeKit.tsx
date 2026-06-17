import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, UploadCloud, X, FileText, Clock, Play, Trash2,
  Loader2, CheckCircle2, AlertCircle, Sparkles, RotateCcw, History,
} from 'lucide-react';
import FloatingLines from '../../shared/FloatingLines';
import Drawer from '../../shared/Drawer';
import { Button } from '../../shared/Button';
import type { JobState, PickedFile, HistoryJob, ToolTab } from './types';
import { useConciergeJob } from './useConciergeJob';

let _seq = 0;
const newId = () => `job-${Date.now()}-${_seq++}`;

// ─── ToolShell ───────────────────────────────────────────────────────────────
// The per-tool page: mirrors the AI Concierge landing recipe (full-bleed header
// band + FloatingLines + serif H1) with a back button and an optional tab bar.

export function ToolShell({
  title, subtitle, onBack, tabs, activeTab, onTab, headerRight, children,
}: {
  title: string;
  subtitle?: string;
  /** Accepted for API compatibility; the header no longer renders a tool icon. */
  icon?: ElementType;
  onBack: () => void;
  tabs?: ToolTab[];
  activeTab?: string;
  onTab?: (id: string) => void;
  /** Optional action pinned to the top-right of the header (e.g. a history button). */
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="h-full flex flex-col overflow-hidden bg-canvas">
      <div className="px-6 lg:px-12 xl:px-[124px] pt-8 shrink-0">
        <div className="bg-canvas-elevated -mx-6 lg:-mx-12 xl:-mx-[124px] px-6 lg:px-12 xl:px-[124px] -mt-8 pt-8 border-b border-canvas-border relative overflow-hidden">
          <FloatingLines
            enabledWaves={['top', 'bottom']}
            lineCount={3}
            lineDistance={10}
            bendRadius={5}
            bendStrength={-0.3}
            interactive
            parallax
            color="#6a12cd"
            opacity={0.05}
          />
          <button
            onClick={onBack}
            className="relative z-10 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-ink-500 hover:text-brand-700 transition-colors cursor-pointer mb-4"
          >
            <ArrowLeft size={15} /> Back to AI Concierge
          </button>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 min-w-0"
          >
            <div className="flex items-start justify-between gap-4">
              <h1 className="font-display text-[30px] font-[420] tracking-tight text-ink-900 leading-[1.15]">
                {title}
              </h1>
              {headerRight && <div className="shrink-0">{headerRight}</div>}
            </div>
            {subtitle && (
              <p className="mt-2 text-[0.9375rem] text-ink-500 leading-relaxed max-w-4xl">
                {subtitle}
              </p>
            )}
            {tabs && tabs.length > 0 ? (
              <div className="mt-5 flex items-center gap-1">
                {tabs.map((t) => {
                  const active = t.id === activeTab;
                  const TabIcon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => onTab?.(t.id)}
                      className={`relative inline-flex items-center gap-1.5 px-3 py-2 text-[0.8125rem] font-semibold transition-colors cursor-pointer ${
                        active ? 'text-brand-700' : 'text-ink-500 hover:text-ink-800'
                      }`}
                    >
                      {TabIcon && <TabIcon size={14} />}
                      {t.label}
                      {active && (
                        <motion.span
                          layoutId="concierge-tool-tab"
                          className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-brand-600"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              // No tab bar (e.g. RACM Generator) — a modest bottom gap below the
              // description so the header reads cleanly (matches reference image9).
              <div className="h-6" aria-hidden />
            )}
          </motion.div>
        </div>
      </div>
      <div className="px-6 lg:px-12 xl:px-[124px] pb-8 flex-1 min-h-0 overflow-y-auto relative">
        <div className="pt-6 h-full">{children}</div>
      </div>
    </div>
  );
}

// ─── UploadZone ──────────────────────────────────────────────────────────────

export function UploadZone({
  accept, multiple = true, maxSizeMb = 50, files, onFiles, hint,
}: {
  accept: string;
  multiple?: boolean;
  maxSizeMb?: number;
  files: PickedFile[];
  onFiles: (f: PickedFile[]) => void;
  hint?: string;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (list: FileList | null) => {
    if (!list) return;
    const incoming: PickedFile[] = Array.from(list)
      .filter((f) => f.size <= maxSizeMb * 1024 * 1024)
      .map((f) => ({ name: f.name, size: f.size, type: f.type }));
    const names = new Set(files.map((f) => f.name));
    const merged = multiple
      ? [...files, ...incoming.filter((f) => !names.has(f.name))]
      : incoming.slice(0, 1);
    onFiles(merged);
  };

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
        className={`rounded-[14px] border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
          drag ? 'border-brand-400 bg-brand-50/50' : 'border-canvas-border hover:border-brand-300 bg-canvas-elevated'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => { add(e.target.files); e.target.value = ''; }}
        />
        <span className="mx-auto mb-3 w-11 h-11 rounded-full bg-brand-50 flex items-center justify-center">
          <UploadCloud size={20} className="text-brand-600" />
        </span>
        <p className="text-[0.875rem] font-semibold text-ink-800">
          Drag &amp; drop {multiple ? 'files' : 'a file'}, or click to browse
        </p>
        {hint && <p className="text-[0.75rem] text-ink-400 mt-1">{hint}</p>}
      </div>

      {files.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[0.75rem] font-semibold text-ink-500">
              {files.length} file{files.length > 1 ? 's' : ''}
            </span>
            {files.length > 1 && (
              <button
                onClick={() => onFiles([])}
                className="text-[0.75rem] font-medium text-ink-400 hover:text-brand-700 cursor-pointer"
              >
                Clear all
              </button>
            )}
          </div>
          {files.map((f, i) => (
            <div
              key={`${f.name}-${i}`}
              className="flex items-center gap-2.5 rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2"
            >
              <FileText size={14} className="text-ink-400 shrink-0" />
              <span className="text-[0.8125rem] text-ink-700 truncate flex-1">{f.name}</span>
              <span className="text-[0.6875rem] text-ink-400 tabular-nums shrink-0">
                {f.size ? `${(f.size / 1024 / 1024).toFixed(1)} MB` : ''}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onFiles(files.filter((_, j) => j !== i)); }}
                className="text-ink-400 hover:text-risk-700 cursor-pointer shrink-0"
                aria-label={`Remove ${f.name}`}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Processing UI ───────────────────────────────────────────────────────────

function PhaseStepIndicator({ stages, stageIndex }: { stages: { id: string; label: string }[]; stageIndex: number }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {stages.map((s, i) => {
        const done = i < stageIndex;
        const active = i === stageIndex;
        return (
          <div key={s.id} className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 text-[0.6875rem] font-semibold px-2 py-1 rounded-full transition-colors ${
                active ? 'bg-brand-50 text-brand-700' : done ? 'text-compliant-700' : 'text-ink-400'
              }`}
            >
              {done ? <CheckCircle2 size={12} /> : active ? <Loader2 size={12} className="animate-spin" /> : <span className="w-1.5 h-1.5 rounded-full bg-ink-300" />}
              {s.label}
            </span>
            {i < stages.length - 1 && <span className="text-ink-300">·</span>}
          </div>
        );
      })}
    </div>
  );
}

function TypewriterText({ text }: { text: string }) {
  const [shown, setShown] = useState('');
  useEffect(() => {
    setShown('');
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, 18);
    return () => window.clearInterval(id);
  }, [text]);
  return <span>{shown}</span>;
}

function InsightPanel({ checking, tips }: { checking: string[]; tips: string[] }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (tips.length < 2) return;
    const id = window.setInterval(() => setT((x) => (x + 1) % tips.length), 5000);
    return () => window.clearInterval(id);
  }, [tips.length]);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
      <div className="rounded-[12px] border border-canvas-border bg-canvas-elevated p-4">
        <p className="text-[0.75rem] font-semibold text-ink-700 mb-2">What we&apos;re checking</p>
        <ul className="space-y-1.5">
          {checking.map((c) => (
            <li key={c} className="flex items-start gap-2 text-[0.8125rem] text-ink-600">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-brand-400 shrink-0" />
              {c}
            </li>
          ))}
        </ul>
      </div>
      {tips.length > 0 && (
        <div className="rounded-[12px] border border-canvas-border bg-brand-50/40 p-4">
          <p className="text-[0.75rem] font-semibold text-brand-700 mb-2 inline-flex items-center gap-1.5">
            <Sparkles size={12} /> Did you know?
          </p>
          <AnimatePresence mode="wait">
            <motion.p
              key={t}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
              className="text-[0.8125rem] text-ink-600 leading-relaxed"
            >
              {tips[t]}
            </motion.p>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export function ProgressPanel({
  state, stages, fileName, onCancel, checking = [], tips = [],
}: {
  state: JobState<unknown>;
  stages: { id: string; label: string }[];
  fileName?: string;
  onCancel: () => void;
  checking?: string[];
  tips?: string[];
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!state.startedAt) return;
    const id = window.setInterval(() => setElapsed(Date.now() - (state.startedAt ?? Date.now())), 500);
    return () => window.clearInterval(id);
  }, [state.startedAt]);
  const mm = String(Math.floor(elapsed / 60000)).padStart(2, '0');
  const ss = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0');

  if (state.status === 'UPLOADING') {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <Loader2 size={28} className="mx-auto text-brand-600 animate-spin mb-3" />
        <p className="text-[0.875rem] font-medium text-ink-700">Uploading…</p>
        {fileName && <p className="text-[0.75rem] text-ink-400 mt-1 truncate">{fileName}</p>}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-[14px] border border-brand-200 bg-canvas-elevated p-5 shadow-[0_12px_32px_rgba(106,18,205,0.06)]">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-brand-600 animate-pulse" />
          <span className="text-[0.875rem] font-semibold text-ink-800 truncate">
            {fileName ? `Analyzing: ${fileName}` : 'Analyzing…'}
          </span>
        </div>

        <div className="mb-4"><PhaseStepIndicator stages={stages} stageIndex={state.stageIndex} /></div>

        <p className="text-[0.8125rem] text-ink-600 min-h-[1.25rem] mb-2">
          <TypewriterText text={state.message} />
        </p>

        <div className="h-2 rounded-full bg-paper-100 overflow-hidden mb-1.5">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600"
            animate={{ width: `${state.progress}%` }}
            transition={{ ease: 'easeOut', duration: 0.3 }}
          />
        </div>
        <div className="flex items-center justify-between text-[0.6875rem] text-ink-400 tabular-nums">
          <span>{state.progress}%</span>
          <span>Time elapsed {mm}:{ss}</span>
        </div>

        <p className="text-[0.6875rem] text-ink-400 mt-3">
          You can keep working — this runs in the background.
        </p>

        <div className="flex items-center justify-between mt-4">
          <button
            onClick={onCancel}
            className="text-[0.8125rem] font-medium text-ink-500 hover:text-risk-700 cursor-pointer"
          >
            Cancel
          </button>
        </div>

        {state.activity.length > 0 && (
          <div className="mt-4 rounded-lg bg-paper-50/70 border border-canvas-border p-3 max-h-28 overflow-y-auto">
            {state.activity.map((a, i) => (
              <p key={i} className="text-[0.6875rem] text-ink-500 leading-relaxed">
                <span className="text-ink-300">›</span> {a}
              </p>
            ))}
          </div>
        )}
      </div>
      <InsightPanel checking={checking} tips={tips} />
    </div>
  );
}

// ─── ResultShell ─────────────────────────────────────────────────────────────

export function ResultShell({
  title = 'Analysis complete', elapsedMs, onNew, actions, children,
}: {
  title?: string;
  elapsedMs?: number | null;
  onNew: () => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const secs = elapsedMs != null ? Math.max(1, Math.round(elapsedMs / 1000)) : null;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <CheckCircle2 size={18} className="text-compliant-700 shrink-0" />
          <h2 className="text-[1.0625rem] font-semibold text-ink-900 truncate">{title}</h2>
          {secs != null && (
            <span className="text-[0.75rem] text-ink-400 shrink-0">in {secs}s</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {actions}
          <button
            onClick={onNew}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[0.8125rem] font-semibold px-3.5 py-2 transition-colors cursor-pointer"
          >
            <RotateCcw size={14} /> New analysis
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── JobHistory ──────────────────────────────────────────────────────────────

const HISTORY_BADGE: Record<string, string> = {
  COMPLETED: 'bg-compliant-50 text-compliant-700',
  IN_PROGRESS: 'bg-brand-50 text-brand-700',
  FAILED: 'bg-risk-50 text-risk-700',
  CANCELLED: 'bg-paper-100 text-ink-500',
};

export function JobHistory({
  jobs, onOpen, onDelete,
}: {
  jobs: HistoryJob[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-[12px] border border-dashed border-canvas-border p-10 text-center">
        <Clock size={22} className="mx-auto text-ink-300 mb-2" />
        <p className="text-[0.875rem] text-ink-500">No jobs yet — run an analysis to see it here.</p>
      </div>
    );
  }
  return (
    <div className="rounded-[12px] border border-canvas-border overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-paper-50/70">
          <tr className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400">
            <th className="px-4 py-2.5">Files</th>
            <th className="px-4 py-2.5">When</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5"></th>
            <th className="px-4 py-2.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id} className="border-t border-canvas-border hover:bg-paper-50/40">
              <td className="px-4 py-2.5 text-[0.8125rem] text-ink-800 max-w-[18rem] truncate">
                {j.files.join(', ') || '—'}
              </td>
              <td className="px-4 py-2.5 text-[0.8125rem] text-ink-500 whitespace-nowrap">{j.createdAt}</td>
              <td className="px-4 py-2.5">
                <span className={`inline-flex items-center text-[0.6875rem] font-semibold px-2 py-0.5 rounded-full ${HISTORY_BADGE[j.status]}`}>
                  {j.status === 'IN_PROGRESS' ? 'In progress' : j.status[0] + j.status.slice(1).toLowerCase()}
                </span>
              </td>
              <td className="px-4 py-2.5 text-[0.75rem] text-ink-400">{j.meta ?? ''}</td>
              <td className="px-4 py-2.5">
                <div className="flex items-center justify-end gap-1.5">
                  {j.status === 'COMPLETED' && (
                    <button
                      onClick={() => onOpen(j.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] font-semibold text-ink-600 hover:border-brand-300 hover:text-brand-700 px-2.5 py-1 cursor-pointer"
                    >
                      <Play size={11} /> Open
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(j.id)}
                    className="p-1.5 rounded-md text-ink-400 hover:text-risk-700 hover:bg-risk-50 cursor-pointer"
                    aria-label="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── ConciergeFlow ───────────────────────────────────────────────────────────
// Standard single-flow composition: Tool tab (upload → progress → result) +
// History tab. Tools with a custom shape (sub-tabs, a pre-upload step) can use
// the primitives above directly instead.

export interface ConciergeFlowProps<R> {
  title: string;
  subtitle?: string;
  icon?: ElementType;
  onBack: () => void;

  accept: string;
  multiple?: boolean;
  maxSizeMb?: number;
  uploadHint?: string;
  uploadCtaLabel?: string;

  stages: { id: string; label: string }[];
  messages?: string[];
  totalMs?: number;
  checking?: string[];
  tips?: string[];

  /** Build the (mock) result from the picked files + any extra options. */
  buildResult: (files: PickedFile[], options: Record<string, unknown>) => R;
  /** Render the completed result. */
  renderResult: (result: R, ctx: { files: PickedFile[]; reset: () => void }) => ReactNode;
  /** Optional right-aligned action buttons in the result header (e.g. export). */
  resultActions?: (result: R) => ReactNode;
  /** Optional small note shown on the History row for a completed job. */
  historyMeta?: (result: R) => string;

  /** Content above the dropzone (instructions, etc.). */
  preUpload?: ReactNode;
  /** Extra controls below the dropzone; edits the shared options object. */
  extraControls?: (options: Record<string, unknown>, set: (patch: Record<string, unknown>) => void) => ReactNode;
  /** Gate the run button. */
  canRun?: (files: PickedFile[], options: Record<string, unknown>) => boolean;

  /**
   * Replace the default dropzone + run button with a custom uploader (e.g. a
   * tile chooser). Receives the live options plus two ways to launch a job:
   * `submit` runs the staged animation; `finishNow` jumps straight to the result.
   */
  renderUpload?: (api: {
    options: Record<string, unknown>;
    setOption: (patch: Record<string, unknown>) => void;
    submit: (files: PickedFile[], extraOptions?: Record<string, unknown>) => void;
    finishNow: (files: PickedFile[], extraOptions?: Record<string, unknown>) => void;
  }) => ReactNode;

  /**
   * Replace the shared progress UI with a custom loader (opt-in, e.g. RACM-only).
   * Receives the live job state plus the stage/checking/tips config.
   */
  renderProgress?: (api: {
    state: JobState<R>;
    stages: { id: string; label: string }[];
    fileName: string;
    checking: string[];
    tips: string[];
    onCancel: () => void;
  }) => ReactNode;
  /** Fired once when the job completes — e.g. to navigate to a result view. */
  onComplete?: (result: R) => void;
  /**
   * Opt-in (RACM-only): hide the Run/History tab bar, default to the run screen,
   * and surface History as an icon button in the header that opens a side sheet.
   */
  historyAsDrawer?: boolean;

  historySeed?: HistoryJob[];

  /**
   * Opt-in (RACM-only): replace the default JobHistory table with a custom list
   * (e.g. a stacked, drawer-friendly history). Receives the jobs + handlers.
   */
  renderHistory?: (api: {
    jobs: HistoryJob[];
    onOpen: (id: string) => void;
    onDelete: (id: string) => void;
  }) => ReactNode;
}

export function ConciergeFlow<R>(props: ConciergeFlowProps<R>) {
  const {
    title, subtitle, onBack,
    accept, multiple = true, maxSizeMb = 50, uploadHint, uploadCtaLabel = 'Run analysis',
    stages, messages, totalMs, checking = [], tips = [],
    buildResult, renderResult, resultActions, historyMeta,
    preUpload, extraControls, canRun, renderUpload, renderProgress, onComplete, historyAsDrawer, historySeed = [],
    renderHistory,
  } = props;

  const [tab, setTab] = useState('tool');
  const [showHistory, setShowHistory] = useState(false);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [options, setOptions] = useState<Record<string, unknown>>({});
  const [history, setHistory] = useState<HistoryJob[]>(historySeed);
  const jobIdRef = useRef<string | null>(null);

  const job = useConciergeJob<{ files: PickedFile[]; options: Record<string, unknown> }, R>({
    stages,
    messages,
    totalMs,
    buildResult: ({ files: f, options: o }) => buildResult(f, o),
  });

  // Reflect completion into the History row created at start.
  useEffect(() => {
    if (job.state.status === 'COMPLETED' && job.state.result) {
      if (jobIdRef.current) {
        const id = jobIdRef.current;
        const meta = historyMeta?.(job.state.result) ?? '';
        setHistory((prev) => prev.map((h) => (h.id === id ? { ...h, status: 'COMPLETED', meta } : h)));
        jobIdRef.current = null;
      }
      onComplete?.(job.state.result);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.state.status]);

  const run = () => {
    const id = newId();
    jobIdRef.current = id;
    setHistory((prev) => [
      { id, files: files.map((f) => f.name), status: 'IN_PROGRESS', createdAt: 'Just now' },
      ...prev,
    ]);
    job.start({ files, options });
  };

  // Launch helpers for a custom uploader (renderUpload). They take files/options
  // explicitly so a click handler can fire without waiting for a state flush.
  const submit = (newFiles: PickedFile[], extra?: Record<string, unknown>) => {
    const opts = { ...options, ...(extra ?? {}) };
    const id = newId();
    jobIdRef.current = id;
    setFiles(newFiles);
    setOptions(opts);
    setHistory((prev) => [
      { id, files: newFiles.map((f) => f.name), status: 'IN_PROGRESS', createdAt: 'Just now' },
      ...prev,
    ]);
    job.start({ files: newFiles, options: opts });
  };
  const finishNow = (newFiles: PickedFile[], extra?: Record<string, unknown>) => {
    const opts = { ...options, ...(extra ?? {}) };
    const result = buildResult(newFiles, opts);
    const id = newId();
    setFiles(newFiles);
    setOptions(opts);
    setHistory((prev) => [
      { id, files: newFiles.map((f) => f.name), status: 'COMPLETED', createdAt: 'Just now', meta: historyMeta?.(result) ?? '' },
      ...prev,
    ]);
    job.complete(result);
  };

  const resetAll = () => {
    job.reset();
    setFiles([]);
    setOptions({});
  };

  const runnable = canRun ? canRun(files, options) : files.length > 0;
  const fileLabel = files.map((f) => f.name).join(', ');

  return (
    <ToolShell
      title={title}
      subtitle={subtitle}
      onBack={onBack}
      tabs={historyAsDrawer ? undefined : [{ id: 'tool', label: title.split(' ')[0] === 'Document' ? 'Analyzer' : 'Run' }, { id: 'history', label: 'History' }]}
      activeTab={tab}
      onTab={(id) => setTab(id)}
      headerRight={historyAsDrawer ? (
        <Button variant="outline" size="md" iconOnly aria-label="Generation history" onClick={() => setShowHistory(true)}>
          <History size={16} />
        </Button>
      ) : undefined}
    >
      {!historyAsDrawer && tab === 'history' ? (
        renderHistory ? renderHistory({
          jobs: history,
          onDelete: (id) => setHistory((prev) => prev.filter((h) => h.id !== id)),
          onOpen: () => { job.complete(buildResult([], {})); setTab('tool'); },
        }) : (
          <JobHistory
            jobs={history}
            onDelete={(id) => setHistory((prev) => prev.filter((h) => h.id !== id))}
            onOpen={() => { job.complete(buildResult([], {})); setTab('tool'); }}
          />
        )
      ) : job.state.status === 'IDLE' ? (
        <div className="h-full">
          {preUpload}
          {renderUpload ? (
            renderUpload({
              options,
              setOption: (patch) => setOptions((o) => ({ ...o, ...patch })),
              submit,
              finishNow,
            })
          ) : (
            <>
              <UploadZone
                accept={accept}
                multiple={multiple}
                maxSizeMb={maxSizeMb}
                files={files}
                onFiles={setFiles}
                hint={uploadHint}
              />
              {extraControls?.(options, (patch) => setOptions((o) => ({ ...o, ...patch })))}
              <button
                disabled={!runnable}
                onClick={run}
                className={`mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg text-[0.875rem] font-semibold px-4 py-2.5 transition-colors ${
                  runnable
                    ? 'bg-brand-600 hover:bg-brand-500 text-white cursor-pointer'
                    : 'bg-brand-100 text-brand-300 cursor-not-allowed'
                }`}
              >
                <Play size={14} /> {uploadCtaLabel}
              </button>
            </>
          )}
        </div>
      ) : job.state.status === 'ERROR' ? (
        <div className="max-w-2xl mx-auto text-center py-16">
          <AlertCircle size={28} className="mx-auto text-risk-700 mb-3" />
          <p className="text-[0.875rem] text-ink-700">{job.state.error ?? 'Something went wrong.'}</p>
          <button onClick={resetAll} className="mt-4 text-[0.8125rem] font-semibold text-brand-700 cursor-pointer">
            Try again
          </button>
        </div>
      ) : job.state.status === 'COMPLETED' && job.state.result ? (
        <ResultShell
          elapsedMs={job.state.elapsedMs}
          onNew={resetAll}
          actions={resultActions?.(job.state.result)}
        >
          {renderResult(job.state.result, { files, reset: resetAll })}
        </ResultShell>
      ) : renderProgress ? (
        renderProgress({ state: job.state, stages, fileName: fileLabel, checking, tips, onCancel: resetAll })
      ) : (
        <ProgressPanel
          state={job.state}
          stages={stages}
          fileName={fileLabel}
          onCancel={resetAll}
          checking={checking}
          tips={tips}
        />
      )}

      {historyAsDrawer && (
        <AnimatePresence>
          {showHistory && (
            <Drawer title="Generation history" onClose={() => setShowHistory(false)}>
              {renderHistory ? renderHistory({
                jobs: history,
                onDelete: (id) => setHistory((prev) => prev.filter((h) => h.id !== id)),
                onOpen: () => { setShowHistory(false); job.complete(buildResult([], {})); },
              }) : (
                <JobHistory
                  jobs={history}
                  onDelete={(id) => setHistory((prev) => prev.filter((h) => h.id !== id))}
                  onOpen={() => { setShowHistory(false); job.complete(buildResult([], {})); }}
                />
              )}
            </Drawer>
          )}
        </AnimatePresence>
      )}
    </ToolShell>
  );
}

// Convenience re-exports
export { useConciergeJob };
export type { JobState, PickedFile, HistoryJob, ToolTab };
