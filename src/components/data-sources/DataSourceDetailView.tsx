import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, Search, Download, ChevronDown, ArrowUpDown,
  FileText, Database, Globe, Cloud, MessageSquare,
  CheckCircle, Loader2, AlertCircle, Pencil, Check, X, Upload,
  Eye, EyeOff, Copy, Mail, Plus,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import {
  DATASET_FILES, FORMAT_TONES, INTEGRATION_CONFIGS, formatBytes,
  type DatasetFile, type FileStatus, type FileFormat, type IntegrationConfig,
} from './datasetFiles';

type SourceType = 'file' | 'database' | 'api' | 'cloud' | 'session';

interface DataSource {
  id: string;
  name: string;
  type: SourceType;
  subtype: string;
  createdAt: string;
}

interface Props {
  source: DataSource;
  onBack: () => void;
  onRename: (newName: string) => void;
  // When true on mount, drop straight into the inline rename input so the
  // 'Rename' menu action lands the user with focus on the name.
  startRenaming?: boolean;
  onStartRenamingConsumed?: () => void;
}

const TYPE_ICON: Record<SourceType, React.ElementType> = {
  file: FileText, database: Database, api: Globe, cloud: Cloud, session: MessageSquare,
};

const STATUS_META: Record<FileStatus, { label: string; tone: string; icon: React.ElementType }> = {
  processed:  { label: 'Processed',  tone: 'text-compliant bg-compliant-50',     icon: CheckCircle },
  processing: { label: 'Processing', tone: 'text-evidence-700 bg-evidence-50',   icon: Loader2 },
  failed:     { label: 'Failed',     tone: 'text-risk bg-risk-50',               icon: AlertCircle },
};

const HEALTH_META: Record<IntegrationConfig['health'], { label: string; tone: string; dot: string }> = {
  healthy:  { label: 'Connection healthy',   tone: 'text-compliant bg-compliant-50',   dot: 'bg-compliant' },
  degraded: { label: 'Connection degraded',  tone: 'text-mitigated-700 bg-mitigated-50', dot: 'bg-mitigated' },
  failed:   { label: 'Connection failed',    tone: 'text-risk bg-risk-50',             dot: 'bg-risk' },
  untested: { label: 'Not yet tested',       tone: 'text-ink-700 bg-paper-100',        dot: 'bg-ink-400' },
};

type SortKey = 'name' | 'size' | 'uploaded';

// Pseudo-progress shape for files mid-upload (Path: simulated client-side).
interface UploadingFile {
  id: string;
  name: string;
  format: FileFormat;
  sizeBytes: number;
  /** 0–100. */
  progress: number;
}

export default function DataSourceDetailView({ source, onBack, onRename, startRenaming, onStartRenamingConsumed }: Props) {
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('uploaded');
  const [sortOpen, setSortOpen] = useState(false);
  const [expandedFileId, setExpandedFileId] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [recentlyAdded, setRecentlyAdded] = useState<DatasetFile[]>([]);

  // Inline rename state
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(source.name);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraftName(source.name); }, [source.name]);
  useEffect(() => {
    if (editingName) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [editingName]);

  // If the parent says "open in rename mode", trip the same path the pencil
  // button uses, then notify so the parent flag can be cleared.
  useEffect(() => {
    if (startRenaming) {
      setDraftName(source.name);
      setEditingName(true);
      onStartRenamingConsumed?.();
    }
  }, [startRenaming, source.name, onStartRenamingConsumed]);

  // Reset uploading state when source changes (drilling between sources)
  useEffect(() => {
    setUploadingFiles([]);
    setRecentlyAdded([]);
  }, [source.id]);

  // Per-source content
  const isFileSource = source.type === 'file';
  const baseFiles = isFileSource ? (DATASET_FILES[source.id] ?? []) : [];
  const allFiles = [...recentlyAdded, ...baseFiles];
  const integrationConfig = !isFileSource ? INTEGRATION_CONFIGS[source.id] : undefined;

  const visible = useMemo(() => {
    const filtered = allFiles.filter(f =>
      !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.format.toLowerCase().includes(search.toLowerCase())
    );
    const cmp = (a: DatasetFile, b: DatasetFile): number => {
      if (sortKey === 'name')   return a.name.localeCompare(b.name);
      if (sortKey === 'size')   return b.sizeBytes - a.sizeBytes;
      return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    };
    return [...filtered].sort(cmp);
  }, [allFiles, search, sortKey]);

  const totalSize = allFiles.reduce((acc, f) => acc + f.sizeBytes, 0);
  const SourceIcon = TYPE_ICON[source.type];

  // ─── Rename handlers ─────────────────────────────────────────────────────
  const startRename = () => { setDraftName(source.name); setEditingName(true); };
  const cancelRename = () => { setEditingName(false); setDraftName(source.name); };
  const commitRename = () => {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === source.name) {
      cancelRename();
      return;
    }
    onRename(trimmed);
    setEditingName(false);
    addToast({ type: 'success', message: `Renamed to "${trimmed}".` });
  };

  // ─── Upload handlers (simulated) ─────────────────────────────────────────
  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const incoming: UploadingFile[] = Array.from(fileList).map((f, i) => {
      const ext = f.name.split('.').pop()?.toUpperCase() ?? 'PDF';
      const format: FileFormat = (['PDF', 'CSV', 'XLSX', 'DOC'] as FileFormat[]).includes(ext as FileFormat)
        ? (ext as FileFormat)
        : 'PDF';
      return {
        id: `up-${Date.now()}-${i}`,
        name: f.name,
        format,
        sizeBytes: f.size,
        progress: 0,
      };
    });
    setUploadingFiles(prev => [...incoming, ...prev]);

    // Drive each upload's progress on its own timer
    incoming.forEach(uf => {
      const tickMs = 90;
      const step = 6 + Math.round(Math.random() * 8); // 6–14% per tick
      const t = setInterval(() => {
        setUploadingFiles(prev => {
          const next = prev.map(p => p.id === uf.id ? { ...p, progress: Math.min(100, p.progress + step) } : p);
          const updated = next.find(p => p.id === uf.id);
          if (updated && updated.progress >= 100) {
            clearInterval(t);
            // Promote to processed file row, remove from uploading list
            setTimeout(() => {
              setUploadingFiles(curr => curr.filter(p => p.id !== uf.id));
              const promoted: DatasetFile = {
                id: uf.id,
                name: uf.name,
                format: uf.format,
                sizeBytes: uf.sizeBytes,
                uploadedAt: new Date().toISOString().slice(0, 10),
                status: 'processed',
                ...(uf.format === 'PDF' || uf.format === 'DOC'
                  ? { pages: Math.max(1, Math.round(uf.sizeBytes / (60 * 1024))) }
                  : { rows: Math.max(1, Math.round(uf.sizeBytes / 80)) }),
              };
              setRecentlyAdded(curr => [promoted, ...curr]);
              addToast({ type: 'success', message: `${uf.name} uploaded.` });
            }, 350);
          }
          return next;
        });
      }, tickMs);
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      className="space-y-5"
    >
      {/* Sub-breadcrumb + back */}
      <div className="flex items-center gap-2 font-mono">
        <button
          onClick={onBack}
          className="flex items-center gap-1 px-2 py-1 text-[12px] font-medium text-ink-500 hover:text-brand-700 hover:bg-paper-50 rounded-md transition-colors cursor-pointer"
        >
          <ChevronLeft size={14} />
          Data Sources
        </button>
        <span className="text-[12px] text-ink-400">/</span>
        <span className="text-[12px] font-medium text-ink-700 truncate">{source.name}</span>
      </div>

      {/* Source header — icon + (rename-capable) name + meta + actions */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="w-12 h-12 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
            <SourceIcon size={22} className="text-brand-700" />
          </div>
          <div className="min-w-0">
            {/* Name row — inline editable */}
            <div className="flex items-center gap-1.5 min-w-0">
              {editingName ? (
                <>
                  <input
                    ref={renameInputRef}
                    value={draftName}
                    onChange={e => setDraftName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRename();
                      else if (e.key === 'Escape') cancelRename();
                    }}
                    className="h-9 px-2 text-[18px] font-semibold text-ink-900 bg-canvas-elevated border border-brand-600 rounded-md focus:outline-none focus:ring-4 focus:ring-brand-600/15 transition-all min-w-0 flex-1"
                  />
                  <button
                    onClick={commitRename}
                    className="p-1.5 text-compliant hover:bg-compliant-50 rounded-md transition-colors cursor-pointer"
                    aria-label="Save name"
                  >
                    <Check size={15} />
                  </button>
                  <button
                    onClick={cancelRename}
                    className="p-1.5 text-ink-500 hover:bg-paper-50 rounded-md transition-colors cursor-pointer"
                    aria-label="Cancel rename"
                  >
                    <X size={15} />
                  </button>
                </>
              ) : (
                <>
                  <h1 className="text-[20px] font-semibold text-ink-900 truncate">{source.name}</h1>
                  <button
                    onClick={startRename}
                    className="p-1.5 text-ink-400 hover:text-brand-700 hover:bg-paper-50 rounded-md transition-colors cursor-pointer shrink-0"
                    aria-label="Rename source"
                  >
                    <Pencil size={13} />
                  </button>
                </>
              )}
            </div>
            <p className="text-[12px] text-ink-500 mt-1 tabular-nums">
              {source.subtype}
              {isFileSource && (
                <>
                  <> · {allFiles.length} {allFiles.length === 1 ? 'file' : 'files'}</>
                  {allFiles.length > 0 && <> · {formatBytes(totalSize)} total</>}
                </>
              )}
              {!isFileSource && integrationConfig && <> · {integrationConfig.provider}</>}
            </p>
          </div>
        </div>
      </div>

      {/* ── Body branches by source type ── */}
      {isFileSource ? (
        <FileSourceBody
          files={allFiles}
          visible={visible}
          uploadingFiles={uploadingFiles}
          search={search}
          setSearch={setSearch}
          sortKey={sortKey}
          setSortKey={setSortKey}
          sortOpen={sortOpen}
          setSortOpen={setSortOpen}
          expandedFileId={expandedFileId}
          setExpandedFileId={setExpandedFileId}
          onUpload={handleFiles}
          onDownload={(name) => addToast({ type: 'success', message: `Downloading ${name}…` })}
        />
      ) : (
        <IntegratedSourceBody
          config={integrationConfig}
          sourceName={source.name}
        />
      )}
    </motion.div>
  );
}

// ─── File-source body ────────────────────────────────────────────────────────

interface FileSourceBodyProps {
  files: DatasetFile[];
  visible: DatasetFile[];
  uploadingFiles: UploadingFile[];
  search: string;
  setSearch: (s: string) => void;
  sortKey: SortKey;
  setSortKey: (k: SortKey) => void;
  sortOpen: boolean;
  setSortOpen: (b: boolean) => void;
  expandedFileId: string | null;
  setExpandedFileId: (s: string | null) => void;
  onUpload: (files: FileList | null) => void;
  onDownload: (name: string) => void;
}

function FileSourceBody({
  files, visible, uploadingFiles, search, setSearch, sortKey, setSortKey, sortOpen, setSortOpen,
  expandedFileId, setExpandedFileId, onUpload, onDownload,
}: FileSourceBodyProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div className="space-y-4">
      {/* Toolbar — search + sort + upload */}
      {(files.length > 0 || uploadingFiles.length > 0) && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              placeholder="Search files…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 h-9 rounded-md border border-canvas-border bg-canvas-elevated text-[12.5px] text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 transition-colors"
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setSortOpen(!sortOpen)}
              className="flex items-center gap-1.5 px-3 h-9 rounded-md border border-canvas-border bg-canvas-elevated text-[12px] font-medium text-ink-700 hover:border-brand-200 transition-colors cursor-pointer"
            >
              <ArrowUpDown size={12} />
              {sortKey === 'name' ? 'Name' : sortKey === 'size' ? 'Size' : 'Uploaded'}
              <ChevronDown size={12} className={`text-ink-400 transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
            </button>
            {sortOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-32 z-20 bg-canvas-elevated border border-canvas-border rounded-md py-1 shadow-md">
                  {(['uploaded', 'name', 'size'] as SortKey[]).map(s => (
                    <button
                      key={s}
                      onClick={() => { setSortKey(s); setSortOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 text-[13px] cursor-pointer transition-colors ${
                        s === sortKey ? 'text-brand-700 font-semibold bg-brand-50' : 'text-ink-700 hover:bg-paper-50'
                      }`}
                    >
                      {s === 'name' ? 'Name' : s === 'size' ? 'Size' : 'Uploaded'}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="ml-auto">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => { onUpload(e.target.files); e.target.value = ''; }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 h-9 rounded-md bg-brand-600 hover:bg-brand-500 active:bg-brand-800 text-white text-[12.5px] font-semibold transition-colors cursor-pointer"
            >
              <Upload size={13} />
              Upload files
            </button>
          </div>
        </div>
      )}

      {/* Drop zone — wraps the file list */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          onUpload(e.dataTransfer.files);
        }}
        className={`rounded-xl border ${isDragging ? 'border-brand-600 bg-brand-50/40' : 'border-canvas-border bg-canvas-elevated'} transition-colors overflow-hidden`}
      >
        {/* Empty state — no files at all */}
        {files.length === 0 && uploadingFiles.length === 0 ? (
          <div className="text-center py-16 px-6">
            <Upload size={28} className="mx-auto text-ink-400 mb-3" />
            <p className="text-[14px] text-ink-700 font-medium">No files in this source yet.</p>
            <p className="text-[12px] text-ink-500 mt-1">Drop files here or click upload to get started.</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 mt-4 px-3 h-9 rounded-md bg-brand-600 hover:bg-brand-500 active:bg-brand-800 text-white text-[12.5px] font-semibold transition-colors cursor-pointer"
            >
              <Upload size={13} />
              Upload files
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-canvas-border">
            {/* Uploading rows pinned at top */}
            <AnimatePresence initial={false}>
              {uploadingFiles.map(uf => (
                <UploadingRow key={uf.id} file={uf} />
              ))}
            </AnimatePresence>

            {/* Filtered + sorted file rows */}
            {visible.length === 0 && uploadingFiles.length === 0 ? (
              <li className="text-center py-12 px-6">
                <Search size={22} className="mx-auto text-ink-400 mb-2" />
                <p className="text-[12.5px] text-ink-500">No files match "{search}".</p>
              </li>
            ) : (
              visible.map(f => (
                <FileRow
                  key={f.id}
                  file={f}
                  expanded={expandedFileId === f.id}
                  onToggle={() => setExpandedFileId(expandedFileId === f.id ? null : f.id)}
                  onDownload={() => onDownload(f.name)}
                />
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Uploading row ───────────────────────────────────────────────────────────

function UploadingRow({ file }: { file: UploadingFile }) {
  const tone = FORMAT_TONES[file.format];
  return (
    <motion.li
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className="overflow-hidden"
    >
      <div className="flex items-center gap-3 px-6 py-3 bg-brand-50/30">
        <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${tone.bg}`}>
          <span className={`text-[10px] font-bold tracking-wide ${tone.text}`}>{file.format}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-[13px] font-medium text-ink-900 truncate">{file.name}</div>
            <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10.5px] font-semibold text-evidence-700 bg-evidence-50">
              <Loader2 size={10} className="animate-spin" />
              Uploading
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-paper-100 overflow-hidden">
              <motion.div
                className="h-full bg-brand-600"
                initial={{ width: 0 }}
                animate={{ width: `${file.progress}%` }}
                transition={{ duration: 0.18, ease: 'linear' }}
              />
            </div>
            <span className="text-[11px] text-ink-500 tabular-nums shrink-0 w-10 text-right">{file.progress}%</span>
          </div>
          <div className="text-[11px] text-ink-500 mt-1 tabular-nums">{formatBytes(file.sizeBytes)}</div>
        </div>
      </div>
    </motion.li>
  );
}

// ─── File row ────────────────────────────────────────────────────────────────

interface FileRowProps {
  file: DatasetFile;
  expanded: boolean;
  onToggle: () => void;
  onDownload: () => void;
}

function FileRow({ file, expanded, onToggle, onDownload }: FileRowProps) {
  const tone = FORMAT_TONES[file.format];
  const status = STATUS_META[file.status];
  const StatusIcon = status.icon;
  const countLabel = file.pages != null
    ? `${file.pages} ${file.pages === 1 ? 'page' : 'pages'}`
    : file.rows != null
      ? `${file.rows.toLocaleString()} ${file.rows === 1 ? 'row' : 'rows'}`
      : null;

  return (
    <li className="group">
      <div className="flex items-center gap-3 px-6 py-3 hover:bg-paper-50 transition-colors">
        <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${tone.bg}`}>
          <span className={`text-[10px] font-bold tracking-wide ${tone.text}`}>{file.format}</span>
        </div>
        <button onClick={onToggle} className="flex-1 min-w-0 text-left cursor-pointer">
          <div className="flex items-center gap-2">
            <div className="text-[13px] font-medium text-ink-900 truncate group-hover:text-brand-700 transition-colors">{file.name}</div>
            <span className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10.5px] font-semibold ${status.tone}`}>
              <StatusIcon size={10} className={file.status === 'processing' ? 'animate-spin' : ''} />
              {status.label}
            </span>
          </div>
          <div className="text-[11px] text-ink-500 mt-0.5 tabular-nums">
            {formatBytes(file.sizeBytes)}
            {countLabel && <> · {countLabel}</>}
            <> · uploaded {new Date(file.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
          </div>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onDownload}
            className="p-2 text-ink-500 hover:text-brand-700 hover:bg-canvas-elevated rounded-md transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
            aria-label={`Download ${file.name}`}
          >
            <Download size={14} />
          </button>
          <button
            onClick={onToggle}
            className="flex items-center gap-1 px-2 py-1.5 text-[12px] font-medium text-ink-500 hover:text-brand-700 hover:bg-canvas-elevated rounded-md transition-colors cursor-pointer"
            aria-expanded={expanded}
          >
            View {file.pages != null ? 'pages' : 'preview'}
            <ChevronDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-3 pt-0">
              <div className="rounded-md border border-canvas-border bg-paper-50/40">
                {file.pages != null ? (
                  <div className="px-3 py-2.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500 mb-2">Pages</div>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: file.pages }, (_, i) => i + 1).map(p => (
                        <button
                          key={p}
                          className="w-9 h-11 rounded border border-canvas-border bg-canvas-elevated text-[11px] font-medium text-ink-700 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/40 transition-colors cursor-pointer flex items-center justify-center tabular-nums"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="px-3 py-2.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500 mb-2">Preview</div>
                    <p className="text-[12px] text-ink-700">
                      First 100 rows available · {(file.rows ?? 0).toLocaleString()} total rows ·
                      <button className="ml-1 text-brand-700 hover:underline cursor-pointer">Open in viewer</button>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

// ─── Integrated source body (database / api / cloud / session) ───────────────
// Reads as a config receipt: provider · health pill · masked-by-default fields
// (click eye to reveal, copy to clipboard) · IT contact card.

interface IntegratedSourceBodyProps {
  config?: IntegrationConfig;
  sourceName: string;
}

function IntegratedSourceBody({ config, sourceName }: IntegratedSourceBodyProps) {
  const { addToast } = useToast();

  if (!config) {
    return (
      <div className="rounded-xl border border-canvas-border bg-canvas-elevated px-6 py-12 text-center">
        <Database size={28} className="mx-auto text-ink-400 mb-3" />
        <p className="text-[14px] text-ink-700 font-medium">No configuration available for this source.</p>
        <p className="text-[12px] text-ink-500 mt-1">Contact IT to set up the integration.</p>
        <a
          href="mailto:support@irame.ai?subject=Integration%20setup%20request"
          className="inline-flex items-center gap-2 mt-4 px-3 h-9 rounded-md bg-brand-600 hover:bg-brand-500 active:bg-brand-800 text-white text-[12.5px] font-semibold transition-colors cursor-pointer"
        >
          <Mail size={13} />
          Email support@irame.ai
        </a>
      </div>
    );
  }

  const health = HEALTH_META[config.health];

  return (
    <div className="space-y-4">
      {/* Connection card — provider name + health */}
      <div className="rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-canvas-border bg-paper-50/40">
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${health.dot}`} />
            <span className="text-[12.5px] font-semibold text-ink-900">{config.provider}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${health.tone}`}>
              {health.label}
            </span>
          </div>
        </div>

        {/* Field rows */}
        <div className="divide-y divide-canvas-border">
          {config.fields.map(f => (
            <ConfigFieldRow key={f.label} field={f} />
          ))}
        </div>
      </div>

      {/* Contact IT card — sticky guidance to keep auditors out of the credential edit path */}
      <div className="rounded-xl border border-evidence-200 bg-evidence-50 px-5 py-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-md bg-evidence-100 flex items-center justify-center shrink-0">
          <Mail size={14} className="text-evidence-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-evidence-700">Need to update this connection?</p>
          <p className="text-[12px] text-evidence-700/80 mt-0.5">
            Credentials and connection settings are managed by IT. Reach out to your IT team or email{' '}
            <a href="mailto:support@irame.ai" className="font-semibold underline">support@irame.ai</a>{' '}
            for changes to <span className="font-semibold">{sourceName}</span>.
          </p>
        </div>
        <a
          href={`mailto:support@irame.ai?subject=Update%20to%20${encodeURIComponent(sourceName)}%20integration`}
          onClick={() => addToast({ type: 'info', message: 'Opening email…' })}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 h-8 rounded-md bg-evidence-700 hover:bg-evidence-600 text-white text-[12px] font-semibold transition-colors cursor-pointer"
        >
          <Mail size={12} />
          Email IT
        </a>
      </div>
    </div>
  );
}

function ConfigFieldRow({ field }: { field: { label: string; value: string; sensitive?: boolean } }) {
  const { addToast } = useToast();
  const [revealed, setRevealed] = useState(false);
  const display = field.sensitive && !revealed
    ? '•'.repeat(Math.min(field.value.length, 18))
    : field.value;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(field.value);
      addToast({ type: 'success', message: `${field.label} copied.` });
    } catch {
      addToast({ type: 'error', message: 'Couldn’t copy to clipboard.' });
    }
  };

  return (
    <div className="grid grid-cols-[180px_1fr_auto] items-center gap-3 px-5 py-2.5 hover:bg-paper-50/60 transition-colors">
      <div className="text-[12px] font-medium text-ink-500">{field.label}</div>
      <div className={`text-[12.5px] text-ink-900 ${field.sensitive && !revealed ? 'tracking-widest font-mono' : 'font-mono'} truncate`}>
        {display}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {field.sensitive && (
          <button
            onClick={() => setRevealed(p => !p)}
            className="p-1.5 text-ink-500 hover:text-brand-700 hover:bg-canvas-elevated rounded-md transition-colors cursor-pointer"
            aria-label={revealed ? 'Hide value' : 'Reveal value'}
          >
            {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        )}
        <button
          onClick={onCopy}
          className="p-1.5 text-ink-500 hover:text-brand-700 hover:bg-canvas-elevated rounded-md transition-colors cursor-pointer"
          aria-label={`Copy ${field.label}`}
        >
          <Copy size={13} />
        </button>
      </div>
    </div>
  );
}
