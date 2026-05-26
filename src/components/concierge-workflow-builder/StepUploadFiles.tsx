import { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UploadCloud,
  File as FileIcon,
  X,
  Database,
  Search,
  ChevronDown,
  ChevronUp,
  Plus,
  Shapes,
} from 'lucide-react';
import type { WorkflowDraft, JourneyFiles, UploadedFile, InputSpec } from './types';
import { DATA_SOURCES } from '../../data/mockData';

interface Props {
  workflow: WorkflowDraft;
  files: JourneyFiles;
  setFiles: (f: JourneyFiles) => void;
  onLinkSource?: (sourceName: string, inputName: string) => void;
  onFocusInput?: (input: InputSpec) => void;
  focusedInputId?: string | null;
  /**
   * Which sections of the upload UI to render.
   *  - 'full' (default): both the upload area and the data-added list
   *  - 'upload-only': drop zone + data sources picker (used inside the modal)
   *  - 'list-only': just the data-added list with an "Add more" trigger
   */
  view?: 'full' | 'upload-only' | 'list-only';
  /** When provided in 'list-only' view, used by the "Add more files" trigger. */
  onOpenUploadModal?: () => void;
  onViewWorkspace?: () => void;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function StepUploadFiles({
  workflow,
  files,
  setFiles,
  onLinkSource,
  view = 'full',
  onOpenUploadModal,
  onViewWorkspace,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadOpen, setUploadOpen] = useState(true);
  const [search, setSearch] = useState('');

  const pickTargetInputId = (current: JourneyFiles): string => {
    const reqInputs = workflow.inputs.filter((i) => i.required);
    for (const inp of reqInputs) {
      if ((current[inp.id] ?? []).length === 0) return inp.id;
    }
    return workflow.inputs[0]?.id ?? '';
  };

  const handlePick = (picked: FileList | null) => {
    if (!picked || picked.length === 0) return;
    const filesArr = Array.from(picked);
    const next = { ...files };
    for (const f of filesArr) {
      const target = pickTargetInputId(next);
      if (!target) continue;
      const added: UploadedFile = { name: f.name, size: f.size };
      next[target] = [...(next[target] ?? []), added];
    }
    setFiles(next);
  };

  const handleRemove = (inputId: string, index: number) => {
    const existing = files[inputId] ?? [];
    const next = existing.filter((_, i) => i !== index);
    setFiles({ ...files, [inputId]: next });
  };

  const totalCount = Object.values(files).reduce((n, arr) => n + arr.length, 0);

  const allFiles = useMemo(() => {
    const rows: {
      file: UploadedFile;
      inputId: string;
      inputName: string;
      index: number;
    }[] = [];
    for (const input of workflow.inputs) {
      const arr = files[input.id] ?? [];
      arr.forEach((file, index) => {
        rows.push({ file, inputId: input.id, inputName: input.name, index });
      });
    }
    return rows;
  }, [files, workflow.inputs]);

  const filteredSources = DATA_SOURCES.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()),
  );

  const linkedSourceNames = useMemo(
    () =>
      new Set(
        Object.values(files)
          .flat()
          .filter((f) => f.linkedSource)
          .map((f) => f.name),
      ),
    [files],
  );

  const toggleSource = (sourceName: string) => {
    if (linkedSourceNames.has(sourceName)) {
      const next: JourneyFiles = {};
      for (const [inputId, arr] of Object.entries(files)) {
        next[inputId] = arr.filter(
          (f) => !(f.linkedSource && f.name === sourceName),
        );
      }
      setFiles(next);
      return;
    }
    const target = pickTargetInputId(files);
    if (!target) return;
    const targetInput = workflow.inputs.find((i) => i.id === target);
    const existing = files[target] ?? [];
    const added: UploadedFile = { name: sourceName, size: 0, linkedSource: true };
    setFiles({ ...files, [target]: [...existing, added] });
    if (targetInput) onLinkSource?.(sourceName, targetInput.name);
  };

  // In list-only view with no files yet, show a compact CTA to (re)open the
  // upload modal so the user always has a way back into uploading.
  if (view === 'list-only' && totalCount === 0) {
    if (!onOpenUploadModal) return null;
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <button
          type="button"
          onClick={onOpenUploadModal}
          className="w-full flex items-center gap-2.5 rounded-xl border border-dashed border-brand-300 bg-brand-50/40 hover:bg-brand-50 transition-colors px-4 py-3 cursor-pointer text-left"
        >
          <span className="w-8 h-8 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
            <UploadCloud size={14} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[0.8125rem] font-semibold text-ink-800">
              Open upload window
            </span>
            <span className="block text-[0.75rem] text-ink-500">
              Add files or link a data source to continue.
            </span>
          </span>
        </button>
      </motion.div>
    );
  }

  const showUploadSection = view !== 'list-only';
  const showDataAdded = view !== 'upload-only' && totalCount > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-4"
    >
      {showUploadSection && (
      /* Upload data files — drop zone (left) + existing data sources (right) */
      <section className="rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden">
        <button
          type="button"
          onClick={() => setUploadOpen((v) => !v)}
          className="w-full flex items-start justify-between gap-4 px-5 py-4 cursor-pointer text-left"
        >
          <div className="min-w-0">
            <div className="text-[0.875rem] font-semibold text-ink-900">
              Upload data files
            </div>
            <p className="text-[0.75rem] text-ink-500 mt-0.5">
              Upload the files required for this workflow, then hit Execute.
            </p>
          </div>
          <span className="text-[0.75rem] text-ink-500 inline-flex items-center gap-1 shrink-0 mt-0.5">
            {uploadOpen ? 'Click to collapse' : 'Click to expand'}
            {uploadOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>

        <AnimatePresence initial={false}>
          {uploadOpen && (
            <motion.div
              key="upload-body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden border-t border-canvas-border/60"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
                {/* Drop zone */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl border border-dashed border-brand-300 bg-brand-50/40 hover:bg-brand-50 transition-colors py-8 px-4 flex flex-col items-center justify-center gap-2 cursor-pointer text-center"
                >
                  <div className="w-12 h-12 rounded-2xl bg-brand-100 text-brand-600 flex items-center justify-center">
                    <UploadCloud size={20} />
                  </div>
                  <div className="text-[0.75rem] font-semibold text-ink-800 mt-1">
                    Drop files here or click to upload
                  </div>
                  <div className="text-[0.75rem] text-ink-500">
                    CSV, PDF, images — any data files for this workflow
                  </div>
                  <div className="text-[0.75rem] text-ink-400 mt-1">
                    Auto-mapped to required inputs
                  </div>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  multiple
                  onChange={(e) => {
                    handlePick(e.target.files);
                    e.target.value = '';
                  }}
                />

                {/* Existing data sources */}
                <div className="rounded-xl border border-canvas-border bg-canvas p-3 flex flex-col min-h-0">
                  <div className="text-center text-[0.75rem] font-bold uppercase tracking-[0.14em] text-ink-400 mb-2.5">
                    Or link from existing data source
                  </div>
                  <div className="relative mb-2.5">
                    <Search
                      size={13}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                    />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search data sources…"
                      className="w-full rounded-full border border-canvas-border bg-canvas-elevated pl-8 pr-3 py-2 text-[0.75rem] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-600/15 focus:border-brand-400/50 transition-all"
                    />
                  </div>
                  <ul className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto pr-0.5">
                    {filteredSources.map((s) => {
                      const selected = linkedSourceNames.has(s.name);
                      return (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => toggleSource(s.name)}
                            aria-pressed={selected}
                            className={[
                              'w-full text-left flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors cursor-pointer',
                              selected
                                ? 'border-brand-400 bg-brand-50/60'
                                : 'border-canvas-border bg-canvas-elevated hover:border-brand-300 hover:bg-brand-50/30',
                            ].join(' ')}
                          >
                            <div className="w-7 h-7 rounded-md bg-brand-50 flex items-center justify-center shrink-0">
                              <Database size={13} className="text-brand-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[0.75rem] font-semibold text-ink-800 truncate">
                                {s.name}
                              </div>
                              <div className="text-[0.75rem] text-ink-400 truncate">
                                {s.records} records · last sync {s.lastSync}
                              </div>
                            </div>
                            <span
                              className={[
                                'w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all',
                                selected
                                  ? 'border-brand-600 bg-brand-600'
                                  : 'border-canvas-border bg-canvas-elevated',
                              ].join(' ')}
                              aria-hidden="true"
                            >
                              {selected && (
                                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                    {filteredSources.length === 0 && (
                      <li className="rounded-lg border border-dashed border-canvas-border px-3 py-4 text-center text-[0.75rem] text-ink-400">
                        No data sources match “{search}”.
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
      )}

      {/* Add Files — list of uploaded / linked files */}
      {showDataAdded && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <UploadCloud size={14} className="text-brand-600" />
            <span className="text-[0.8125rem] font-semibold text-ink-800">Data added</span>
            <span className="text-[0.75rem] text-ink-400 rounded-full bg-canvas px-2 py-0.5 border border-canvas-border tabular-nums">
              {totalCount}
            </span>
            {(view === 'list-only' && onOpenUploadModal) || view === 'full' ? (
              <button
                type="button"
                onClick={() => {
                  if (view === 'list-only') onOpenUploadModal?.();
                  else fileInputRef.current?.click();
                }}
                className="ml-auto inline-flex items-center gap-1 rounded-full border border-canvas-border bg-canvas-elevated hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/40 text-[0.75rem] font-semibold text-ink-600 px-2.5 py-1 transition-colors cursor-pointer"
              >
                <Plus size={11} />
                Add more
              </button>
            ) : null}
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {allFiles.map(({ file, inputId, inputName, index }) => (
              <li
                key={`${inputId}-${file.name}-${index}`}
                className="flex items-center gap-2.5 bg-canvas rounded-lg border border-canvas-border px-3 py-2"
              >
                <div className="w-7 h-7 rounded-md bg-brand-50 flex items-center justify-center shrink-0">
                  {file.linkedSource ? (
                    <Database size={13} className="text-brand-600" />
                  ) : (
                    <FileIcon size={13} className="text-brand-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[0.75rem] font-semibold text-ink-800 truncate">
                    {file.name}
                  </div>
                  <div className="text-[0.75rem] text-ink-400 truncate">
                    {file.linkedSource ? 'Linked from data source' : humanSize(file.size)}
                  </div>
                </div>
                <span className="text-[0.75rem] font-semibold uppercase tracking-wide rounded-md bg-canvas-elevated border border-canvas-border text-ink-500 px-1.5 py-0.5 shrink-0 max-w-[130px] truncate">
                  {inputName}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(inputId, index)}
                  className="text-ink-400 hover:text-risk transition-colors cursor-pointer shrink-0"
                  aria-label={`Remove ${file.name}`}
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-canvas-border flex items-center justify-end">
            <button
              type="button"
              onClick={() => onViewWorkspace?.()}
              className="inline-flex items-center gap-1.5 rounded-md border border-canvas-border bg-canvas-elevated hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/40 px-3 py-1.5 text-[0.75rem] font-semibold text-ink-700 transition-colors cursor-pointer"
            >
              <Shapes size={13} />
              View Workspace
            </button>
          </div>
        </section>
      )}
    </motion.div>
  );
}
