import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, Search, ChevronDown, ArrowDown, ArrowUp,
  FileText, FolderOpen, Database, Globe, Cloud, MessageSquare,
  CheckCircle, Loader2, AlertCircle, AlertOctagon, Pencil, Check, X, Upload,
  Eye, EyeOff, Copy, Mail, Plus, RotateCcw,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import { Button } from '../shared/Button';
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
  isFolder?: boolean;
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
  failed:     { label: 'Failed',     tone: 'text-risk-700 bg-risk-50',           icon: AlertCircle },
};

// Health pill uses an outline + colored dot so it doesn't read as the same green
// chip as the file-Processed status. Color stays on the dot; chip stays neutral.
const HEALTH_META: Record<IntegrationConfig['health'], { label: string; tone: string; dot: string }> = {
  healthy:  { label: 'Connection healthy',   tone: 'text-ink-700 bg-canvas-elevated border border-canvas-border',     dot: 'bg-compliant' },
  degraded: { label: 'Connection degraded',  tone: 'text-mitigated-700 bg-canvas-elevated border border-canvas-border', dot: 'bg-mitigated' },
  failed:   { label: 'Connection failed',    tone: 'text-risk-700 bg-canvas-elevated border border-canvas-border',     dot: 'bg-risk' },
  untested: { label: 'Not yet tested',       tone: 'text-ink-700 bg-paper-100',                                         dot: 'bg-ink-400' },
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
  // Set when the user clicks Cancel; suppresses the onBlur-driven commit
  // so cancel-on-mousedown wins over save-on-blur.
  const suppressBlurCommitRef = useRef(false);

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

  // Single-file sources auto-expand their preview — no extra click required.
  useEffect(() => {
    if (!source.isFolder && allFiles.length === 1) {
      setExpandedFileId(allFiles[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.id, source.isFolder, allFiles.length]);

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
  // Folders get the FolderOpen + evidence-tile treatment so the detail header
  // matches the card on DataSourcesView. File-source files stay brand-tiled.
  const SourceIcon = source.isFolder ? FolderOpen : TYPE_ICON[source.type];
  const iconTileClass = source.isFolder
    ? 'bg-evidence-50'
    : 'bg-brand-50';
  const iconColorClass = source.isFolder
    ? 'text-evidence-700'
    : 'text-brand-700';

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
      const format: FileFormat = (['PDF', 'CSV', 'XLSX'] as FileFormat[]).includes(ext as FileFormat)
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
                ...(uf.format === 'PDF'
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
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 px-2 py-1 text-[0.75rem] font-medium text-ink-500 hover:text-brand-700 hover:bg-paper-50 rounded-md transition-colors cursor-pointer"
        >
          <ChevronLeft size={14} />
          Data Sources
        </button>
        <span className="font-mono text-[0.75rem] text-ink-300">/</span>
        <span className="text-[0.75rem] font-medium text-ink-700 truncate">{source.name}</span>
      </div>

      {/* Source header — icon + (rename-capable) name + meta + actions */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={`w-12 h-12 rounded-lg ${iconTileClass} flex items-center justify-center shrink-0`}>
            <SourceIcon size={22} className={iconColorClass} />
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
                    onBlur={() => {
                      if (suppressBlurCommitRef.current) {
                        suppressBlurCommitRef.current = false;
                        return;
                      }
                      commitRename();
                    }}
                    className="h-9 px-2 text-[1rem] font-semibold tracking-tight text-ink-900 bg-canvas-elevated border border-brand-600 rounded-md focus:outline-none focus:ring-4 focus:ring-brand-600/15 transition-all min-w-0 flex-1"
                  />
                  <button
                    onClick={commitRename}
                    className="p-1.5 text-compliant hover:bg-compliant-50 rounded-md transition-colors cursor-pointer"
                    aria-label="Save name"
                  >
                    <Check size={15} />
                  </button>
                  <button
                    onMouseDown={() => { suppressBlurCommitRef.current = true; }}
                    onClick={cancelRename}
                    className="p-1.5 text-ink-500 hover:bg-paper-50 rounded-md transition-colors cursor-pointer"
                    aria-label="Cancel rename"
                  >
                    <X size={15} />
                  </button>
                </>
              ) : (
                <>
                  <h1 className="text-[1.25rem] font-semibold tracking-tight text-ink-900 truncate">{source.name}</h1>
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
            <p className="text-[0.75rem] text-ink-500 mt-1 tabular-nums">
              {source.subtype}
              {isFileSource && allFiles.length > 1 && (
                <> · {allFiles.length} files · {formatBytes(totalSize)} total</>
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
          isFolder={source.isFolder === true}
          search={search}
          setSearch={setSearch}
          sortKey={sortKey}
          setSortKey={setSortKey}
          sortOpen={sortOpen}
          setSortOpen={setSortOpen}
          expandedFileId={expandedFileId}
          setExpandedFileId={setExpandedFileId}
          onUpload={handleFiles}
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
  isFolder: boolean;
  search: string;
  setSearch: (s: string) => void;
  sortKey: SortKey;
  setSortKey: (k: SortKey) => void;
  sortOpen: boolean;
  setSortOpen: (b: boolean) => void;
  expandedFileId: string | null;
  setExpandedFileId: (s: string | null) => void;
  onUpload: (files: FileList | null) => void;
}

function FileSourceBody({
  files, visible, uploadingFiles, isFolder, search, setSearch, sortKey, setSortKey, sortOpen, setSortOpen,
  expandedFileId, setExpandedFileId, onUpload,
}: FileSourceBodyProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div className="space-y-4">
      {/* Toolbar — search + sort + upload. Single-file sources skip the
          toolbar entirely; the lone file row says everything. */}
      {isFolder && (files.length > 0 || uploadingFiles.length > 0) && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              placeholder="Search files…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 h-9 rounded-md border border-canvas-border bg-paper-50 text-[0.75rem] text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 transition-colors"
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setSortOpen(!sortOpen)}
              className="flex items-center gap-1.5 px-3 h-9 rounded-md border border-canvas-border bg-paper-50 text-[0.75rem] font-medium text-ink-700 hover:border-brand-200 transition-colors cursor-pointer"
            >
              {sortKey === 'name' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
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
                      className={`w-full text-left px-3 py-1.5 text-[0.875rem] cursor-pointer transition-colors ${
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
            <Button
              variant={isFolder ? 'outline' : 'primary'}
              leftIcon={<Upload size={13} />}
              onClick={() => fileInputRef.current?.click()}
            >
              {isFolder ? 'Add files to this folder' : 'Upload files'}
            </Button>
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
        className={`relative rounded-xl border ${isDragging ? 'border-brand-300 bg-brand-50/40' : 'border-canvas-border bg-canvas-elevated'} transition-colors overflow-hidden`}
      >
        {isDragging && (
          <div
            aria-hidden
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
          >
            <span className="font-mono text-[0.75rem] uppercase tracking-wider text-brand-700">
              Drop to upload
            </span>
          </div>
        )}
        {/* Empty state — no files at all */}
        {files.length === 0 && uploadingFiles.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-paper-50 flex items-center justify-center">
              <Upload size={20} className="text-ink-400" />
            </div>
            <p className="text-[0.875rem] text-ink-700 font-medium">No files in this source yet.</p>
            <p className="text-[0.75rem] text-ink-500 mt-1">Drop files here or click upload to get started.</p>
            <div className="mt-4">
              <Button
                variant={isFolder ? 'outline' : 'primary'}
                leftIcon={<Upload size={13} />}
                onClick={() => fileInputRef.current?.click()}
              >
                {isFolder ? 'Add files to this folder' : 'Upload files'}
              </Button>
            </div>
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
                <p className="text-[0.75rem] text-ink-500">No files match "{search}".</p>
              </li>
            ) : (
              visible.map(f => (
                <FileRow
                  key={f.id}
                  file={f}
                  expanded={expandedFileId === f.id}
                  isSingle={!isFolder && files.length === 1}
                  onToggle={() => setExpandedFileId(expandedFileId === f.id ? null : f.id)}
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
          <span className={`text-[0.75rem] font-bold tracking-wide ${tone.text}`}>{file.format}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-[0.875rem] font-medium text-ink-900 truncate">{file.name}</div>
            <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[0.75rem] font-semibold text-evidence-700 bg-evidence-50">
              <Loader2 size={10} className="animate-spin motion-reduce:animate-none" />
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
            <span className="text-[0.75rem] text-ink-500 tabular-nums shrink-0 w-10 text-right">{file.progress}%</span>
          </div>
          <div className="text-[0.75rem] text-ink-500 mt-1 tabular-nums">{formatBytes(file.sizeBytes)}</div>
        </div>
      </div>
    </motion.li>
  );
}

// ─── File row ────────────────────────────────────────────────────────────────

interface FileRowProps {
  file: DatasetFile;
  expanded: boolean;
  isSingle: boolean;
  onToggle: () => void;
}

function FileRow({ file, expanded, isSingle, onToggle }: FileRowProps) {
  const { addToast } = useToast();
  const tone = FORMAT_TONES[file.format];
  const status = STATUS_META[file.status];
  const StatusIcon = status.icon;
  const isFailed = file.status === 'failed';
  const countLabel = file.pages != null
    ? `${file.pages} ${file.pages === 1 ? 'page' : 'pages'}`
    : file.rows != null
      ? `${file.rows.toLocaleString()} ${file.rows === 1 ? 'row' : 'rows'}`
      : null;

  // Shared title + meta block. In single-file mode it's a plain <div>; in
  // folder/multi-file mode it's a <button> that toggles the preview.
  const titleBlock = (
    <>
      <div className="flex items-center gap-2">
        <div className={`text-[0.875rem] font-medium text-ink-900 truncate ${isSingle ? '' : 'group-hover:text-brand-700 transition-colors'}`}>{file.name}</div>
        <span className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[0.75rem] font-semibold ${status.tone}`}>
          <StatusIcon size={10} className={file.status === 'processing' ? 'animate-spin motion-reduce:animate-none' : ''} />
          {status.label}
        </span>
      </div>
      <div className="text-[0.75rem] text-ink-500 mt-0.5 tabular-nums">
        {formatBytes(file.sizeBytes)}
        {countLabel && <> · {countLabel}</>}
        <> · uploaded {new Date(file.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
      </div>
      {isFailed && (
        <div className="text-[0.75rem] text-risk-700 mt-0.5">
          Processing failed. Format may not be supported.
        </div>
      )}
    </>
  );

  // The preview block content — same shape in both modes.
  const previewBlock = (
    <div className="px-6 pb-3 pt-0">
      <div className="rounded-md border border-canvas-border bg-paper-50/40">
        {file.pages != null ? (
          <div className="px-3 py-2.5">
            <div className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-500 mb-2">Pages</div>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: file.pages }, (_, i) => i + 1).map(p => (
                <span
                  key={p}
                  className="w-9 h-11 rounded border border-canvas-border bg-canvas-elevated text-[0.75rem] font-medium text-ink-700 flex items-center justify-center tabular-nums"
                  aria-hidden
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="px-3 py-2.5">
            <div className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-500 mb-2">Preview</div>
            <p className="text-[0.75rem] text-ink-700 tabular-nums">
              First 100 rows available · {(file.rows ?? 0).toLocaleString()} total rows
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <li className="group">
      <div className={`flex items-center gap-3 px-6 py-3 transition-colors ${isSingle ? 'cursor-default' : 'hover:bg-paper-50'}`}>
        <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${tone.bg}`}>
          <span className={`text-[0.75rem] font-bold tracking-wide ${tone.text}`}>{file.format}</span>
        </div>
        {isSingle ? (
          <div className="flex-1 min-w-0">
            {titleBlock}
          </div>
        ) : (
          <button onClick={onToggle} className="flex-1 min-w-0 text-left cursor-pointer">
            {titleBlock}
          </button>
        )}
        <div className="flex items-center gap-1 shrink-0">
          {isFailed && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<RotateCcw size={12} />}
              onClick={() => addToast({ type: 'info', message: 'Retrying upload…' })}
            >
              Retry
            </Button>
          )}
          {!isSingle && (
            <button
              onClick={onToggle}
              className="flex items-center gap-1 px-2 py-1.5 text-[0.75rem] font-medium text-ink-500 hover:text-brand-700 hover:bg-canvas-elevated rounded-md transition-colors cursor-pointer"
              aria-expanded={expanded}
            >
              View {file.pages != null ? 'pages' : 'preview'}
              <ChevronDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {isSingle ? (
        <div>{previewBlock}</div>
      ) : (
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
              className="overflow-hidden"
            >
              {previewBlock}
            </motion.div>
          )}
        </AnimatePresence>
      )}
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
  const { addToast, updateToast } = useToast();

  if (!config) {
    return (
      <div className="rounded-xl border border-canvas-border bg-canvas-elevated px-6 py-12 text-center">
        <Database size={28} className="mx-auto text-ink-400 mb-3" />
        <p className="text-[0.875rem] text-ink-700 font-medium">No configuration available for this source.</p>
        <p className="text-[0.75rem] text-ink-500 mt-1">Contact IT to set up the integration.</p>
        <a
          href="mailto:support@irame.ai?subject=Integration%20setup%20request"
          className="inline-flex items-center gap-2 mt-4 px-3.5 h-9 rounded-lg bg-primary text-white text-sm font-medium shadow-sm shadow-brand-900/10 hover:bg-primary-hover hover:shadow-md hover:shadow-brand-900/15 transition-[background-color,box-shadow] duration-150"
        >
          <Mail size={13} />
          Email support@irame.ai
        </a>
      </div>
    );
  }

  const health = HEALTH_META[config.health];

  const handleRetest = () => {
    const id = addToast({ type: 'loading', message: 'Testing connection…' });
    setTimeout(() => updateToast(id, { type: 'success', message: 'Connection healthy.' }), 1200);
  };

  return (
    <div className="space-y-4">
      {/* Connection-failed banner — only when the last sync errored */}
      {config.health === 'failed' && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-risk-50 border border-risk/30">
          <AlertOctagon size={16} className="text-risk-700 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[0.875rem] font-semibold text-risk-700">Last sync failed.</div>
            <p className="text-[0.75rem] text-ink-700 mt-0.5">
              IRA can't read from this source. Re-test the connection or contact IT.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<RotateCcw size={12} />}
                onClick={handleRetest}
              >
                Re-test connection
              </Button>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Mail size={12} />}
                onClick={() => {
                  addToast({ type: 'info', message: 'Opening email…' });
                  window.location.href = `mailto:support@irame.ai?subject=Connection%20failed%20for%20${encodeURIComponent(sourceName)}`;
                }}
              >
                Email IT
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Connection card — provider name + health */}
      <div className="rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-canvas-border bg-paper-50/40">
          <div className="flex items-center gap-2">
            <span className="text-[0.75rem] font-semibold tracking-tight text-ink-900">{config.provider}</span>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[0.75rem] font-semibold ${health.tone}`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${health.dot}`} />
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
          <p className="text-[0.875rem] font-semibold tracking-tight text-evidence-700">Need to update this connection?</p>
          <p className="text-[0.75rem] text-evidence-700/80 mt-0.5">
            Credentials and connection settings are managed by IT. Reach out to your IT team or email{' '}
            <a href="mailto:support@irame.ai" className="font-semibold underline">support@irame.ai</a>{' '}
            for changes to <span className="font-semibold">{sourceName}</span>.
          </p>
        </div>
        <a
          href={`mailto:support@irame.ai?subject=Update%20to%20${encodeURIComponent(sourceName)}%20integration`}
          onClick={() => addToast({ type: 'info', message: 'Opening email…' })}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 h-8 rounded-md bg-evidence-700 hover:bg-evidence-600 text-white text-[0.75rem] font-semibold transition-colors cursor-pointer"
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
      <div className="text-[0.75rem] font-medium text-ink-500">{field.label}</div>
      <div className={`text-[0.75rem] text-ink-900 ${field.sensitive && !revealed ? 'tracking-widest font-mono' : 'font-mono'} truncate`}>
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
