import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  ChevronLeft, ChevronRight, Search, ChevronDown, ArrowUpDown,
  FileText, FolderOpen, Database, Globe, Cloud, MessageSquare,
  Loader2, AlertCircle, AlertOctagon, Pencil, Check, X, Upload,
  Eye, EyeOff, Copy, Mail, Plus, RotateCcw, Download, Table2,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import { Button } from '../shared/Button';
import InlineRename from '../shared/InlineRename';
import {
  filesForSource, getFileBlob, loadFileBlob, registerFileBlob, setSourceFiles, metaForFormat, countPdfPages, countSheetRows, getPdfjs,
  validateUploadFile, isAllowedKnowledgeFile,
  INTEGRATION_CONFIGS, formatBytes,
  type DatasetFile, type FileStatus, type FileFormat, type IntegrationConfig,
} from './datasetFiles';
import { TODAY } from './sources';

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

// Status → label. Tone is owned by StatusPillFlat (the sole consumer); the
// pill is flat by design, so no per-status icon is carried here.
const STATUS_META: Record<FileStatus, { label: string }> = {
  processed:  { label: 'Processed' },
  processing: { label: 'Processing' },
  failed:     { label: 'Failed' },
};

// Health pill uses an outline + colored dot so it doesn't read as the same green
// chip as the file-Processed status. Color stays on the dot; chip stays neutral.
const HEALTH_META: Record<IntegrationConfig['health'], { label: string; tone: string; dot: string }> = {
  healthy:  { label: 'Connection healthy',   tone: 'text-ink-700 bg-canvas-elevated border border-canvas-border',     dot: 'bg-compliant' },
  degraded: { label: 'Connection degraded',  tone: 'text-mitigated-700 bg-canvas-elevated border border-canvas-border', dot: 'bg-mitigated' },
  failed:   { label: 'Connection failed',    tone: 'text-risk-700 bg-canvas-elevated border border-canvas-border',     dot: 'bg-risk' },
  untested: { label: 'Not yet tested',       tone: 'text-ink-700 bg-paper-100',                                         dot: 'bg-ink-400' },
};

type SortKey = 'name' | 'type' | 'size' | 'rows' | 'uploaded' | 'status';
type SortDir = 'asc' | 'desc';

// Pseudo-progress shape for files mid-upload (Path: simulated client-side).
interface UploadingFile {
  id: string;
  name: string;
  format: FileFormat;
  sizeBytes: number;
  /** 0–100. */
  progress: number;
  /** Real bytes — kept for the in-session preview + true page/row count. */
  file?: File;
}

export default function DataSourceDetailView({ source, onBack, onRename, startRenaming, onStartRenamingConsumed }: Props) {
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('uploaded');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedFileId, setExpandedFileId] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [recentlyAdded, setRecentlyAdded] = useState<DatasetFile[]>([]);
  // Guards against promoting the same upload twice — the progress updater is a
  // setState callback, which React StrictMode double-invokes in dev.
  const promotedRef = useRef<Set<string>>(new Set());

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
  const baseFiles = isFileSource ? filesForSource(source) : [];
  // A just-uploaded file is persisted into baseFiles (so it survives reload) AND
  // kept in recentlyAdded (so it stays pinned on top this session) — dedupe by
  // id so it isn't listed twice.
  const recentlyAddedIds = new Set(recentlyAdded.map(f => f.id));
  const allFiles = [...recentlyAdded, ...baseFiles.filter(f => !recentlyAddedIds.has(f.id))];
  const integrationConfig = !isFileSource ? INTEGRATION_CONFIGS[source.id] : undefined;
  // For a single-file source, the header carries that file's status + date and
  // a direct download (folders download the whole pack instead).
  const headerFile = isFileSource && !source.isFolder ? allFiles[0] : undefined;

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
    const dir = sortDir === 'asc' ? 1 : -1;
    const rowCount = (f: DatasetFile) => f.rows ?? f.pages ?? 0;
    const cmp = (a: DatasetFile, b: DatasetFile): number => {
      switch (sortKey) {
        case 'name':   return a.name.localeCompare(b.name) * dir;
        case 'type':   return (a.format.localeCompare(b.format) || a.name.localeCompare(b.name)) * dir;
        case 'size':   return (a.sizeBytes - b.sizeBytes) * dir;
        case 'rows':   return (rowCount(a) - rowCount(b)) * dir;
        case 'status': return (a.status.localeCompare(b.status) || a.name.localeCompare(b.name)) * dir;
        default:       return (new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()) * dir;
      }
    };
    // Pin just-uploaded files to the top (newest first) regardless of the sort
    // key, so a fresh upload is always visible; everything else sorts normally.
    const recentIds = new Set(recentlyAdded.map(f => f.id));
    const recent = filtered.filter(f => recentIds.has(f.id)); // keeps insertion order (newest first)
    const rest   = filtered.filter(f => !recentIds.has(f.id)).sort(cmp);
    return [...recent, ...rest];
  }, [allFiles, recentlyAdded, search, sortKey, sortDir]);

  const totalSize = allFiles.reduce((acc, f) => acc + f.sizeBytes, 0);
  // Folders get the FolderOpen + evidence-tile treatment so the detail header
  // matches the card on DataSourcesView. File-source files stay brand-tiled.
  const SourceIcon = source.isFolder ? FolderOpen : TYPE_ICON[source.type];

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

  // Bump to force a re-read of DATASET_FILES (a module map, not React state)
  // after an in-place file rename.
  const [, bumpFiles] = useReducer((n: number) => n + 1, 0);

  // Rename a single file inside this source. Uploads are kept in recentlyAdded
  // for pinning AND persisted into DATASET_FILES, so update both: the state map
  // (no-op if absent) keeps the pinned copy in sync, and setSourceFiles persists
  // the change so it survives a reload (it also materialises a synthesised
  // listing into DATASET_FILES on first edit).
  const renameFile = (fileId: string, newName: string) => {
    const name = newName.trim();
    if (!name) return;
    setRecentlyAdded(curr => curr.map(f => (f.id === fileId ? { ...f, name } : f)));
    setSourceFiles(source.id, filesForSource(source).map(f => (f.id === fileId ? { ...f, name } : f)));
    bumpFiles();
    addToast({ type: 'success', message: `Renamed to "${name}".` });
  };

  // ─── Upload handlers (simulated) ─────────────────────────────────────────

  // Promote a finished upload to a processed file row. Registers the real bytes
  // for the in-session preview and parses the true page/row count (pdf.js /
  // SheetJS), falling back to the size estimate — same path as the page picker.
  const promoteUpload = async (uf: UploadingFile) => {
    setUploadingFiles(curr => curr.filter(p => p.id !== uf.id));
    if (uf.file) registerFileBlob(uf.id, uf.file);
    let meta: Pick<DatasetFile, 'pages' | 'rows'> = metaForFormat(uf.format, uf.sizeBytes);
    if (uf.file) {
      if (uf.format === 'PDF') {
        const pages = await countPdfPages(uf.file);
        if (pages != null) meta = { pages };
      } else {
        const rows = await countSheetRows(uf.file);
        if (rows != null) meta = { rows };
      }
    }
    const promoted: DatasetFile = {
      id: uf.id,
      name: uf.name,
      format: uf.format,
      sizeBytes: uf.sizeBytes,
      uploadedAt: TODAY.toISOString().slice(0, 10),
      status: 'processed',
      ...meta,
    };
    setRecentlyAdded(curr => [promoted, ...curr]);
    // Persist the file into the source's list so it survives a page reload. The
    // bytes were already saved to IndexedDB via registerFileBlob above; without
    // this the row lived only in component state and vanished on refresh.
    setSourceFiles(source.id, [promoted, ...filesForSource(source)]);
    bumpFiles();
    addToast({ type: 'success', message: `${uf.name} uploaded.` });
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    // Same gate the Add-source picker enforces: only PDF/CSV/XLSX, and each
    // must pass content validation (not empty / corrupt / password-protected)
    // before it can be added. Without this, dropping e.g. a .xml here would
    // sail straight through and show as "Processed".
    const all = Array.from(fileList);
    const typed = all.filter(f => isAllowedKnowledgeFile(f.name));
    const skippedType = all.length - typed.length;
    if (skippedType > 0) {
      addToast({ type: 'info', message: `${skippedType} file${skippedType > 1 ? 's' : ''} skipped — only PDF, CSV, XLSX are supported.` });
    }
    if (typed.length === 0) return;

    const checked = await Promise.all(typed.map(async f => ({ f, res: await validateUploadFile(f) })));
    const accepted: File[] = [];
    for (const { f, res } of checked) {
      if (res.ok) accepted.push(f);
      else addToast({ type: 'error', message: `${f.name} — ${res.reason}` });
    }
    if (accepted.length === 0) return;

    const incoming: UploadingFile[] = accepted.map((f, i) => {
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
        file: f,
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
            // Idempotent: schedule the promote once even if this updater is
            // double-invoked (StrictMode) or the tick fires again.
            if (!promotedRef.current.has(uf.id)) {
              promotedRef.current.add(uf.id);
              setTimeout(() => { void promoteUpload(uf); }, 350);
            }
          }
          return next;
        });
      }, tickMs);
    });
  };

  // Download the whole folder. A real backend streams a .zip; here we export a
  // manifest of the folder's contents so the action is wired and honest.
  const downloadFolder = () => {
    const lines = allFiles.map(f => `${f.name}\t${formatBytes(f.sizeBytes)}`).join('\n');
    const content = `# ${source.name}\n# ${allFiles.length} files · ${formatBytes(totalSize)}\n\n${lines}\n`;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${source.name}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    addToast({ type: 'success', message: `Downloading ${source.name} — ${allFiles.length} files…` });
  };

  // Header download: the whole folder, or the single file for a file source.
  const downloadHeader = () => {
    if (source.isFolder) { downloadFolder(); return; }
    if (headerFile) { triggerDownload(headerFile); addToast({ type: 'success', message: `Downloading ${headerFile.name}…` }); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      className="flex flex-col gap-5 h-full min-h-0"
    >
      {/* Back */}
      <div className="flex items-center shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 px-2 py-1 text-[0.75rem] font-medium text-ink-500 hover:text-brand-700 hover:bg-brand-50 rounded-md transition-colors cursor-pointer"
        >
          <ChevronLeft size={14} />
          Data Sources
        </button>
      </div>

      {/* Source header — flat hairline card (Linear/Notion aesthetic). No
          gradient hero, no ambient lines, no floating shadow: the detail opens
          on the same calm surface as the gallery. Brand is reserved for the
          icon square and the rename/selection accents. */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.2, 0, 0, 1], delay: 0.04 }}
        className="shrink-0 rounded-xl border border-canvas-border bg-canvas-elevated"
      >
        <div className="flex items-center justify-between gap-4 flex-wrap px-5 py-4">
        <div className="group/hd flex items-center gap-3.5 min-w-0 flex-1">
          <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
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
                    onBlur={() => {
                      if (suppressBlurCommitRef.current) {
                        suppressBlurCommitRef.current = false;
                        return;
                      }
                      commitRename();
                    }}
                    className="h-10 px-2.5 text-[1.125rem] font-semibold tracking-tight text-ink-900 bg-canvas-elevated border border-brand-600 rounded-lg focus:outline-none transition-all min-w-0 flex-1"
                  />
                  <button
                    onClick={commitRename}
                    className="p-1.5 text-brand-700 hover:bg-brand-50 rounded-md transition-colors cursor-pointer"
                    aria-label="Save name"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onMouseDown={() => { suppressBlurCommitRef.current = true; }}
                    onClick={cancelRename}
                    className="p-1.5 text-ink-500 hover:bg-brand-50 rounded-md transition-colors cursor-pointer"
                    aria-label="Cancel rename"
                  >
                    <X size={16} />
                  </button>
                </>
              ) : (
                <>
                  <h1
                    onClick={startRename}
                    title="Rename source"
                    className="text-[1.125rem] font-semibold tracking-tight text-ink-900 truncate cursor-pointer hover:text-brand-700 transition-colors"
                  >
                    {source.name}
                  </h1>
                  <button
                    onClick={startRename}
                    className="p-1 text-ink-400 hover:text-brand-700 hover:bg-brand-50 rounded-md transition-colors cursor-pointer shrink-0 opacity-0 group-hover/hd:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                    aria-label="Rename source"
                  >
                    <Pencil size={13} />
                  </button>
                </>
              )}
            </div>
            {/* Meta row — format chip, then facts, then the status pill at the
                end behind a faint divider (report-cover layout). The chip carries
                the type, so the facts drop the redundant format token. */}
            <div className="flex items-center gap-2 mt-1 text-[0.8125rem] text-ink-500 tabular-nums">
              <span className="inline-flex items-center shrink-0 px-1.5 h-[1.125rem] rounded-md bg-brand-50 text-[0.625rem] font-bold uppercase tracking-wide text-brand-700">
                {source.isFolder ? 'Folder' : isFileSource ? (headerFile?.format ?? source.subtype.split('·')[0].trim()) : source.type}
              </span>
              <span className="truncate">
                {source.isFolder
                  // Folders: count + total size.
                  ? `${allFiles.length} ${allFiles.length === 1 ? 'file' : 'files'} · ${formatBytes(totalSize)}`
                  : isFileSource && headerFile
                    // Single file: size · upload date (format is the chip).
                    ? <>{formatBytes(headerFile.sizeBytes)} · uploaded {new Date(headerFile.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
                    : <>{source.subtype}{integrationConfig && <> · {integrationConfig.provider}</>}</>}
              </span>
              {headerFile && (
                <>
                  <span className="text-ink-300">|</span>
                  <StatusPillFlat status={headerFile.status} />
                </>
              )}
            </div>
          </div>
        </div>
        {isFileSource && allFiles.length > 0 && headerFile?.status !== 'failed' && (
          /* Download — whole folder, or the single file. Flat neutral tile that
             tints to brand on hover, matching the gallery's hover language. */
          <button
            onClick={downloadHeader}
            title={source.isFolder ? 'Download all files' : 'Download file'}
            aria-label={source.isFolder ? 'Download all files' : 'Download file'}
            className="group shrink-0 flex items-center justify-center w-10 h-10 rounded-lg border border-canvas-border text-ink-500 hover:border-brand-200 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer"
          >
            <Download size={18} className="transition-transform duration-200 group-hover:translate-y-0.5 motion-reduce:transition-none" />
          </button>
        )}
        </div>
      </motion.div>

      {/* ── Body branches by source type ── A folder shows the reading pane
          (its own rail/preview scroll internally); everything else fills the
          remaining height and scrolls *inside* this region, so the back link
          and header stay pinned and the page itself never scrolls. */}
      <div className={`flex flex-col min-h-0 ${source.isFolder ? 'shrink-0 h-[calc(100vh-13rem)]' : 'flex-1 overflow-y-auto'}`}>
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
            sortDir={sortDir}
            setSortDir={setSortDir}
            expandedFileId={expandedFileId}
            setExpandedFileId={setExpandedFileId}
            onUpload={handleFiles}
            onRenameFile={renameFile}
          />
        ) : (
          <IntegratedSourceBody
            config={integrationConfig}
            sourceName={source.name}
          />
        )}
      </div>
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
  sortDir: SortDir;
  setSortDir: (d: SortDir) => void;
  expandedFileId: string | null;
  setExpandedFileId: (s: string | null) => void;
  onUpload: (files: FileList | null) => void;
  onRenameFile: (id: string, newName: string) => void;
}

function FileSourceBody({
  files, visible, uploadingFiles, isFolder, search, setSearch, sortKey, setSortKey, sortDir, setSortDir,
  expandedFileId, setExpandedFileId, onUpload, onRenameFile,
}: FileSourceBodyProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Reading-pane: the LIST stays on the left and the selected file previews
  // LIVE on the right — so moving through files (click or ↑/↓) shows content
  // with no opening, no back. Selection falls back to the first visible file
  // so the pane is never empty.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = visible.find(f => f.id === selectedId) ?? visible[0] ?? null;

  const fill = isFolder && (files.length > 0 || uploadingFiles.length > 0);
  // Single-file preview: the spreadsheet/PDF preview is already its own card, so
  // the wrapper drops its border/bg to avoid a card-inside-a-card. Only a *lone*
  // file is its own card; a multi-file (non-folder) list still wants the card
  // container so its rows read as a contained list, not floating on bare canvas.
  const singlePreview = !isFolder && files.length === 1;

  // ↑/↓ steps the selection (and thus the live preview) when focus isn't in a
  // text field. This is the "see without clicking each" path.
  useEffect(() => {
    if (!fill) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const idx = visible.findIndex(f => f.id === selected?.id);
      const next = e.key === 'ArrowDown' ? visible[Math.min(idx + 1, visible.length - 1)] : visible[Math.max(idx - 1, 0)];
      if (next) setSelectedId(next.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fill, visible, selected?.id]);

  // Keep the selected row visible while arrowing through the list.
  useEffect(() => {
    if (!fill || !selected) return;
    listRef.current?.querySelector(`[data-file-id="${CSS.escape(selected.id)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [fill, selected?.id]);

  // A handful of plain-language sort orders — enough for "find my file",
  // without the noise of six sortable column headers.
  const SORTS: { key: SortKey; dir: SortDir; label: string }[] = [
    { key: 'uploaded', dir: 'desc', label: 'Newest first' },
    { key: 'uploaded', dir: 'asc',  label: 'Oldest first' },
    { key: 'name',     dir: 'asc',  label: 'Name (A–Z)' },
    { key: 'size',     dir: 'desc', label: 'Largest first' },
  ];
  const activeSort = SORTS.find(s => s.key === sortKey && s.dir === sortDir) ?? SORTS[0];

  return (
    <div className={fill ? 'flex flex-col gap-4 h-full min-h-0' : 'space-y-4'}>
      {/* Finder bar — search leads (the job here is finding one file), then sort + upload. */}
      {isFolder && (files.length > 0 || uploadingFiles.length > 0) && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="relative flex-1 min-w-[220px] max-w-xl">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search files by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="no-focus-ring w-full pl-9 pr-9 h-[38px] rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-300 transition-colors"
            />
            {search && (
              <button
                onClick={() => { setSearch(''); searchRef.current?.focus(); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-md text-ink-400 hover:text-ink-700 hover:bg-brand-50 transition-colors cursor-pointer"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="relative ml-auto">
            <button
              onClick={() => setSortOpen(!sortOpen)}
              className="no-focus-ring flex items-center gap-2 px-3 h-[38px] rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] font-medium text-ink-700 hover:border-brand-300 focus-visible:border-brand-400 transition-colors cursor-pointer"
            >
              <ArrowUpDown size={13} className="text-ink-400 shrink-0" />
              <span>{activeSort.label}</span>
              <ChevronDown size={13} className={`text-ink-400 transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
            </button>
            {sortOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                <div className="absolute left-0 right-0 top-full mt-1 w-full z-20 bg-canvas-elevated border border-canvas-border rounded-lg py-1 shadow-md">
                  {SORTS.map(s => {
                    const on = s.key === sortKey && s.dir === sortDir;
                    return (
                      <button
                        key={s.label}
                        onClick={() => { setSortKey(s.key); setSortDir(s.dir); setSortOpen(false); }}
                        className={`w-full text-left px-3 py-1.5 text-[0.8125rem] cursor-pointer transition-colors whitespace-nowrap ${on ? 'text-brand-700 font-semibold bg-brand-50' : 'text-ink-700 hover:bg-brand-50'}`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.csv,.xlsx"
              className="hidden"
              onChange={(e) => { onUpload(e.target.files); e.target.value = ''; }}
            />
            {/* Platform primary CTA — brand-600 / white, gap-2, rounded-md,
                sized to the finder bar's h-[38px] so the row aligns. */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 h-[38px] rounded-md bg-brand-600 hover:bg-brand-500 active:bg-brand-800 text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer"
            >
              <Plus size={14} />
              Add files
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
        className={`relative transition-colors ${isDragging ? 'rounded-xl overflow-hidden border border-brand-300 bg-brand-50/40' : singlePreview ? '' : 'rounded-xl overflow-hidden border border-canvas-border bg-canvas-elevated shadow-[0_1px_2px_rgb(15_8_30_/_0.04)]'} ${fill ? 'flex-1 min-h-0 flex flex-col' : ''}`}
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
                variant="primary"
                leftIcon={<Plus size={14} />}
                onClick={() => fileInputRef.current?.click()}
              >
                {isFolder ? 'Add files' : 'Upload files'}
              </Button>
            </div>
          </div>
        ) : isFolder ? (
          /* Folder → reading pane: finder list (left) + live preview (right).
             Selecting a row (click or ↑/↓) updates the preview instantly. */
          <div className="flex flex-1 min-h-0">
            <div className="w-80 shrink-0 border-r border-canvas-border flex flex-col min-h-0 bg-canvas-elevated">
              {/* List header — aligns with the preview header (h-12) so the
                  divider runs straight across; shows count + keyboard hint. */}
              <div className="shrink-0 flex items-center justify-between gap-2 px-3 h-16 border-b border-canvas-border bg-canvas-elevated">
                <span className="inline-flex items-baseline gap-1.5 min-w-0">
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400">
                    {search ? 'Results' : 'Files'}
                  </span>
                  <span className="text-[0.6875rem] font-semibold tabular-nums text-ink-400">
                    {search ? `${visible.length} of ${files.length}` : files.length}
                  </span>
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[0.625rem] text-ink-400">
                  <kbd className="inline-flex items-center justify-center min-w-[1.125rem] h-[1.125rem] px-1 rounded border border-canvas-border bg-canvas font-mono text-[0.625rem] text-ink-400">↑</kbd>
                  <kbd className="inline-flex items-center justify-center min-w-[1.125rem] h-[1.125rem] px-1 rounded border border-canvas-border bg-canvas font-mono text-[0.625rem] text-ink-400">↓</kbd>
                  <span className="ml-0.5">to move</span>
                </span>
              </div>
              <div ref={listRef} className="flex-1 overflow-y-auto">
                <FileList
                  visible={visible}
                  uploadingFiles={uploadingFiles}
                  search={search}
                  selectedId={selected?.id ?? null}
                  onSelect={setSelectedId}
                />
              </div>
            </div>
            <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-canvas-elevated">
              {selected ? (
                <PreviewPane file={selected} />
              ) : (
                <div className="flex-1 flex items-center justify-center text-[0.8125rem] text-ink-400">
                  Select a file to preview it here.
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Single-file source — one always-open inline preview, no list. */
          <ul className="divide-y divide-canvas-border">
            <AnimatePresence initial={false}>
              {uploadingFiles.map(uf => (
                <UploadingRow key={uf.id} file={uf} />
              ))}
            </AnimatePresence>
            {visible.map(f => (
              <FileRow
                key={f.id}
                file={f}
                expanded={expandedFileId === f.id}
                isSingle={files.length === 1}
                onToggle={() => setExpandedFileId(expandedFileId === f.id ? null : f.id)}
                onRename={onRenameFile}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Uploading row ───────────────────────────────────────────────────────────

function UploadingRow({ file }: { file: UploadingFile }) {
  return (
    <motion.li
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className="overflow-hidden"
    >
      <div className="flex items-center gap-3 px-6 py-3 bg-brand-50/30">
        <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
          <FileText size={18} className="text-brand-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-[0.875rem] font-semibold text-ink-900 truncate">{file.name}</div>
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

// ─── Spreadsheet preview (real CSV / XLSX) ───────────────────────────────────
// Parses the uploaded bytes with SheetJS and renders the first rows as a real
// table. SheetJS reads both .csv and .xlsx, so one path covers both.

// A value reads as numeric once currency/percent/thousands separators are
// stripped — used to right-align number columns like a real spreadsheet.
function looksNumeric(v: string): boolean {
  if (v.trim() === '') return false;
  const cleaned = v.replace(/[,$%\s]/g, '');
  return cleaned !== '' && !Number.isNaN(Number(cleaned));
}

// Presentational spreadsheet — sheet bar + row-number gutter + sticky header +
// numeric-aware alignment. Shared by the live (parsed bytes) and sample
// (synthesised, for files with no real bytes) previews.
function SpreadsheetTable({ header, body, totalRows, totalCols, live, sheetNames, activeSheet = 0, onSelectSheet, maxHeightClass = 'max-h-[360px]', bare = false }: {
  header: string[];
  body: string[][];
  totalRows: number;
  totalCols: number;
  live: boolean;
  sheetNames: string[];
  activeSheet?: number;
  onSelectSheet?: (i: number) => void;
  maxHeightClass?: string;
  bare?: boolean;
}) {
  const multi = sheetNames.length > 1;
  const activeName = sheetNames[activeSheet] ?? sheetNames[0] ?? 'Sheet1';
  const colCount = Math.max(header.length, ...body.map(r => r.length));
  const colNumeric = Array.from({ length: colCount }, (_, ci) => {
    const vals = body.map(r => r[ci] ?? '').filter(v => v.trim() !== '');
    return vals.length > 0 && vals.filter(looksNumeric).length / vals.length >= 0.6;
  });
  const cellAlign = (ci: number) => (colNumeric[ci] ? 'text-right tabular-nums' : 'text-left');

  // A `w-full` table forces 4 narrow columns to sprawl across the whole pane
  // with big empty gaps. Instead: short columns hug their content and the one
  // prose-heavy column (longest content) absorbs the slack. If nothing is
  // prose-y, the table hugs left at its natural width rather than stretching.
  const colMaxLen = (ci: number) =>
    Math.max((header[ci] ?? '').length, 0, ...body.map(r => (r[ci] ?? '').length));
  let flexCol = -1;
  let flexBest = 24; // a column must read as prose (>24 chars) to win the slack
  header.forEach((_, ci) => { const l = colMaxLen(ci); if (l > flexBest) { flexBest = l; flexCol = ci; } });
  const hasFlex = flexCol >= 0;

  return (
    <div className={bare ? '' : 'rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden shadow-[0_1px_2px_rgb(15_8_30_/_0.04)]'}>
      {/* Sheet switcher up top — for multi-sheet workbooks this is the most
          important control, so it leads instead of hiding under the table. */}
      <div className="flex items-center justify-between gap-3 px-2.5 h-12 border-b border-canvas-border bg-canvas shrink-0">
        {multi ? (
          <div className="flex items-center gap-1 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {sheetNames.map((name, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSelectSheet?.(i)}
                aria-pressed={i === activeSheet}
                title={name}
                className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md text-[0.75rem] max-w-[12rem] truncate transition-colors cursor-pointer ${
                  i === activeSheet
                    ? 'bg-brand-50 text-brand-700 font-semibold'
                    : 'text-ink-500 hover:text-ink-800 hover:bg-brand-50'
                }`}
              >
                <Table2 size={13} className={i === activeSheet ? 'text-brand-600 shrink-0' : 'text-ink-400 shrink-0'} />
                <span className="truncate">{name}</span>
              </button>
            ))}
          </div>
        ) : (
          <span className="inline-flex items-center gap-2.5 text-[0.8125rem] font-semibold text-ink-800 truncate">
            <span className="w-7 h-7 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><Table2 size={15} /></span>
            {activeName}
          </span>
        )}
        <span className="text-[0.6875rem] text-ink-400 tabular-nums shrink-0">
          {totalRows.toLocaleString()} rows × {totalCols.toLocaleString()} cols
        </span>
      </div>

      <div className={`overflow-auto ${maxHeightClass}`}>
        <table className="border-collapse text-[0.75rem] w-full">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="sticky left-0 z-20 w-10 px-2.5 py-2.5 bg-canvas-elevated border-b border-canvas-border" aria-hidden />
              {header.map((h, i) => (
                <th
                  key={i}
                  title={h}
                  className={`px-3.5 py-2.5 bg-canvas-elevated border-b border-canvas-border text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-500 truncate ${i === flexCol ? 'w-full' : 'min-w-[5rem] max-w-[13rem]'} ${colNumeric[i] ? 'text-right' : 'text-left'}`}
                >
                  {h}
                </th>
              ))}
              {/* No prose column to absorb the slack → a blank filler column
                  stretches the row to the card's full width (so short-column
                  sheets don't leave a dead zone on the right). */}
              {!hasFlex && <th aria-hidden className="w-full bg-canvas-elevated border-b border-canvas-border" />}
            </tr>
          </thead>
          <tbody>
            {body.map((row, r) => (
              <tr key={r} className="group/row border-b border-canvas-border/40 last:border-0 transition-colors hover:bg-brand-50">
                <td className="sticky left-0 z-10 w-10 px-2.5 text-right text-[0.6875rem] text-ink-300 tabular-nums select-none bg-canvas-elevated transition-colors group-hover/row:bg-paper-50">
                  {r + 1}
                </td>
                {header.map((_, ci) => {
                  const v = row[ci] ?? '';
                  return (
                    <td
                      key={ci}
                      className={`px-3.5 py-2 text-[0.75rem] text-ink-700 ${ci === flexCol ? 'max-w-0 truncate' : 'max-w-[13rem] truncate'} ${cellAlign(ci)}`}
                      title={v}
                    >
                      {v === '' ? <span className="text-ink-300">—</span> : v}
                    </td>
                  );
                })}
                {/* Filler cell — pairs with the header filler to carry the row's
                    hover + bottom border across the full width. */}
                {!hasFlex && <td aria-hidden />}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-3 h-9 flex items-center border-t border-canvas-border text-[0.75rem] text-ink-500 tabular-nums">
        Showing first {body.length} {body.length === 1 ? 'row' : 'rows'}
        <span className="text-ink-400"> · {totalRows.toLocaleString()} total · {live ? 'live preview' : 'sample preview'}</span>
      </div>
    </div>
  );
}

// Live preview — parses the uploaded bytes with SheetJS (reads CSV and XLSX).
// Parses the workbook once, then lets the user switch between sheets via tabs.
const SHEET_MAX_ROWS = 50;
const SHEET_MAX_COLS = 12;

function extractSheet(wb: XLSX.WorkBook, i: number): { rows: string[][]; total: number; cols: number } {
  const sheet = wb.Sheets[wb.SheetNames[i]];
  const all = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: '', raw: false });
  const range = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : null;
  const cols = range ? range.e.c - range.s.c + 1 : (all[0]?.length ?? 0);
  const rows = all.slice(0, SHEET_MAX_ROWS).map(r => r.slice(0, SHEET_MAX_COLS).map(c => String(c ?? '')));
  return { rows, total: Math.max(0, all.length - 1), cols };
}

function SpreadsheetPreview({ url, totalRows, maxHeightClass, bare = false }: { url: string; totalRows?: number; maxHeightClass?: string; bare?: boolean }) {
  const wbRef = useRef<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const [data, setData] = useState<{ rows: string[][]; total: number; cols: number } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const buf = await (await fetch(url)).arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array', cellDates: true });
        if (cancelled) return;
        wbRef.current = wb;
        setSheetNames(wb.SheetNames);
        setActive(0);
        setData(extractSheet(wb, 0));
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  const selectSheet = (i: number) => {
    if (!wbRef.current || i === active) return;
    setActive(i);
    setData(extractSheet(wbRef.current, i));
  };

  const shellClass = bare ? '' : 'rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden shadow-[0_1px_2px_rgb(15_8_30_/_0.04)]';
  if (failed || (data && data.rows.length === 0)) {
    return (
      <div className={shellClass}>
        <div className="flex flex-col items-center justify-center gap-2 text-center py-16 px-6">
          <Table2 size={22} className="text-ink-300" />
          <p className="text-[0.8125rem] text-ink-700 font-medium">Preview unavailable</p>
          <p className="text-[0.75rem] text-ink-500 tabular-nums">
            {totalRows != null ? `${totalRows.toLocaleString()} total rows · couldn’t render a preview` : 'This file couldn’t be parsed for preview.'}
          </p>
        </div>
      </div>
    );
  }
  if (!data) {
    // Table skeleton — cool shimmer sweep, six aligned columns mirroring the
    // loaded table so the load reads as the table forming (and holds the same
    // ~400px height, so there's no size jump when data arrives).
    return (
      <div className={shellClass}>
        {/* Sheet-tab bar — tabs left, count right. */}
        <div className="flex items-center justify-between gap-2.5 px-3 h-12 border-b border-canvas-border bg-canvas">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-md skeleton-cool shrink-0" />
            <span className="h-3 w-16 rounded skeleton-cool" />
            <span className="h-3 w-14 rounded skeleton-cool" />
          </div>
          <span className="h-2.5 w-24 rounded skeleton-cool shrink-0" />
        </div>
        {/* Column-header row. */}
        <div className="flex items-center gap-4 px-4 h-9 border-b border-canvas-border/60">
          <span className="h-2.5 w-6 rounded skeleton-cool shrink-0" />
          <span className="h-2.5 w-16 rounded skeleton-cool shrink-0" />
          <span className="h-2.5 flex-1 rounded skeleton-cool" />
          <span className="h-2.5 w-16 rounded skeleton-cool shrink-0" />
          <span className="h-2.5 w-20 rounded skeleton-cool shrink-0" />
          <span className="h-2.5 w-24 rounded skeleton-cool shrink-0" />
          <span className="h-2.5 w-12 rounded skeleton-cool shrink-0" />
        </div>
        {/* Data rows. */}
        <div className="px-4 py-3 space-y-3.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <span className="h-3 w-6 rounded skeleton-cool shrink-0" />
              <span className="h-3 w-16 rounded skeleton-cool shrink-0" />
              <span className="h-3 flex-1 rounded skeleton-cool" />
              <span className="h-3 w-16 rounded skeleton-cool shrink-0" />
              <span className="h-3 w-20 rounded skeleton-cool shrink-0" />
              <span className="h-3 w-24 rounded skeleton-cool shrink-0" />
              <span className="h-3 w-12 rounded skeleton-cool shrink-0" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  const [header, ...rest] = data.rows;
  return (
    <SpreadsheetTable
      header={header}
      body={rest}
      totalRows={data.total}
      totalCols={data.cols}
      sheetNames={sheetNames}
      activeSheet={active}
      onSelectSheet={selectSheet}
      maxHeightClass={maxHeightClass}
      bare={bare}
      live
    />
  );
}

// Bundled real sample files (in /public/samples). Demo/seed sources — which
// have no uploaded bytes — render these ACTUAL files through the real renderers,
// so the preview shows real document/spreadsheet data, not generated content.
const SAMPLE_ASSETS = {
  pdf: '/samples/audit-report.pdf',
  csv: '/samples/dataset.csv',
  xlsx: '/samples/workbook.xlsx',
} as const;

// CSV/XLSX demo files → parse and render the real bundled sample spreadsheet.
function SampleSheetPreview({ file, maxHeightClass, bare = false }: { file: DatasetFile; maxHeightClass?: string; bare?: boolean }) {
  const url = file.format === 'CSV' ? SAMPLE_ASSETS.csv : SAMPLE_ASSETS.xlsx;
  return <SpreadsheetPreview url={url} maxHeightClass={maxHeightClass} bare={bare} />;
}

// Renders one real PDF page to a canvas via pdf.js, scaled to targetWidth.
function PdfCanvas({ doc, pageNumber, targetWidth }: { doc: PDFDocumentProxy; pageNumber: number; targetWidth: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    (async () => {
      const pageObj = await doc.getPage(pageNumber);
      if (cancelled || !ref.current) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const base = pageObj.getViewport({ scale: 1 });
      const viewport = pageObj.getViewport({ scale: (targetWidth / base.width) * dpr });
      const canvas = ref.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${targetWidth}px`;
      canvas.style.height = `${viewport.height / dpr}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      task = pageObj.render({ canvas, canvasContext: ctx, viewport });
      try { await task.promise; } catch { /* cancelled */ }
    })();
    return () => { cancelled = true; try { task?.cancel(); } catch { /* noop */ } };
  }, [doc, pageNumber, targetWidth]);
  return <canvas ref={ref} className="block" />;
}

// The page-by-page PDF viewer: a thumbnail rail + the active page, both rendered
// as REAL PDF pages (pdf.js → canvas). Used for uploaded files (their bytes) and
// for demo files (a generated PDF) alike — so it's always a real PDF render.
function PdfCanvasViewer({ source, fileName, bare = false }: { source: string | Blob; fileName: string; bare?: boolean }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    (async () => {
      try {
        const pdfjs = await getPdfjs();
        const buf = source instanceof Blob ? await source.arrayBuffer() : await (await fetch(source)).arrayBuffer();
        const d = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
        if (cancelled) { d.destroy(); return; }
        loaded = d;
        setDoc(d);
        setNumPages(d.numPages);
        setPage(1);
      } catch { if (!cancelled) setFailed(true); }
    })();
    return () => { cancelled = true; loaded?.destroy(); };
  }, [source]);

  if (failed) {
    return (
      <div className="rounded-lg border border-canvas-border bg-canvas-elevated px-3 h-[120px] flex items-center justify-center text-[0.75rem] text-ink-500">
        Preview unavailable.
      </div>
    );
  }
  if (!doc) {
    // Compact centred loader — matches the spreadsheet preview's loading state.
    return (
      <div className={bare ? '' : 'rounded-xl border border-canvas-border bg-canvas-elevated shadow-[0_1px_2px_rgb(15_8_30_/_0.04)]'}>
        <div className="flex flex-col items-center justify-center gap-3 min-h-[400px] px-6 text-center">
          <span className="flex items-center justify-center w-11 h-11 rounded-full bg-brand-50">
            <Loader2 size={20} className="text-brand-600 animate-spin motion-reduce:animate-none" />
          </span>
          <div>
            <p className="text-[0.8125rem] font-semibold text-ink-800">Loading preview</p>
            <p className="text-[0.75rem] text-ink-400 mt-0.5">Rendering pages…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden ${bare ? '' : 'rounded-xl border border-canvas-border bg-canvas-elevated shadow-[0_1px_2px_rgb(15_8_30_/_0.04)]'}`}>
      <div className="flex items-center justify-between gap-2 px-3 h-9 border-b border-canvas-border bg-paper-50/60">
        <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-semibold text-ink-700 truncate">
          <FileText size={13} className="text-risk shrink-0" />
          Document
        </span>
        <span className="text-[0.6875rem] text-ink-400 tabular-nums shrink-0">{numPages} {numPages === 1 ? 'page' : 'pages'}</span>
      </div>

      <div className="flex h-[440px] bg-paper-100/50">
        {/* Thumbnail rail — real rendered page images. */}
        <div className="w-[116px] shrink-0 border-r border-canvas-border bg-paper-50/40 overflow-y-auto p-2.5 space-y-2.5">
          {Array.from({ length: numPages }, (_, idx) => idx + 1).map(i => (
            <button
              key={i}
              type="button"
              onClick={() => setPage(i)}
              className="block w-full group cursor-pointer"
              aria-label={`Page ${i}`}
              aria-current={i === page}
            >
              <div className={`rounded-[2px] border bg-white overflow-hidden transition-shadow ${i === page ? 'border-brand-400 ring-2 ring-brand-200 shadow-sm' : 'border-canvas-border group-hover:border-brand-300'}`}>
                <PdfCanvas doc={doc} pageNumber={i} targetWidth={92} />
              </div>
              <div className={`mt-1 text-center text-[0.625rem] tabular-nums ${i === page ? 'text-brand-700 font-semibold' : 'text-ink-400'}`}>{i}</div>
            </button>
          ))}
        </div>

        {/* Active page — larger real render. */}
        <div className="flex-1 overflow-auto flex justify-center px-6 py-6">
          <div className="self-start rounded-[2px] border border-canvas-border/70 shadow-[0_8px_28px_rgb(15_8_30_/_0.12)] overflow-hidden bg-white">
            <PdfCanvas doc={doc} pageNumber={page} targetWidth={360} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 px-3 h-11 border-t border-canvas-border">
        <button
          type="button"
          disabled={page === 1}
          onClick={() => setPage(p => Math.max(1, p - 1))}
          className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors ${page === 1 ? 'text-ink-300 cursor-not-allowed' : 'text-ink-500 hover:text-brand-700 hover:bg-brand-50 cursor-pointer'}`}
          aria-label="Previous page"
        >
          <ChevronLeft size={15} />
        </button>
        <span className="text-[0.75rem] text-ink-600 tabular-nums">Page <span className="font-semibold text-ink-800">{page}</span> of {numPages}</span>
        <button
          type="button"
          disabled={page === numPages}
          onClick={() => setPage(p => Math.min(numPages, p + 1))}
          className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors ${page === numPages ? 'text-ink-300 cursor-not-allowed' : 'text-ink-500 hover:text-brand-700 hover:bg-brand-50 cursor-pointer'}`}
          aria-label="Next page"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

// Demo PDF (no uploaded bytes): render the real bundled sample PDF, page-by-page,
// through the same canvas viewer as uploaded files.
function SamplePdfPreview({ file, bare = false }: { file: DatasetFile; bare?: boolean }) {
  return <PdfCanvasViewer source={SAMPLE_ASSETS.pdf} fileName={file.name} bare={bare} />;
}

// Resolves a file's real bytes for preview: instant for files uploaded this
// session (in-memory), or rehydrated from IndexedDB after a reload. Returns
// undefined until/unless real bytes exist (seed files stay undefined → mock).
function useFileBlob(fileId: string) {
  const [blob, setBlob] = useState(() => getFileBlob(fileId));
  useEffect(() => {
    const mem = getFileBlob(fileId);
    if (mem) { setBlob(mem); return; }
    setBlob(undefined);
    let cancelled = false;
    loadFileBlob(fileId).then(b => { if (!cancelled && b) setBlob(b); });
    return () => { cancelled = true; };
  }, [fileId]);
  return blob;
}

// Demo download — no real bytes, so export a small metadata placeholder named
// after the file. A real backend swaps the Blob for the actual stream.
function triggerDownload(file: DatasetFile) {
  const content = file.format === 'CSV'
    ? `# ${file.name}\n# Demo export from Knowledge Hub — ${(file.rows ?? 0).toLocaleString()} rows\ncolumn_a,column_b,column_c\n`
    : `${file.name}\nDemo export from Knowledge Hub.\nFormat: ${file.format} · ${formatBytes(file.sizeBytes)}\n`;
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// The actual preview surface for a file, picked by type + whether real uploaded
// bytes exist. Shared by the inline single-file view, the split preview pane,
// and the full-screen overlay.
function FilePreviewBody({ file, tall = false, bare = false }: { file: DatasetFile; tall?: boolean; bare?: boolean }) {
  const isPdf = file.pages != null;
  const blob = useFileBlob(file.id);
  const realPdf = isPdf && !!blob && (blob.mime === 'application/pdf' || file.format === 'PDF');
  const realSheet = !isPdf && !!blob;
  // Tall mode (split pane / full-screen) lets sheet tables use far more
  // vertical room than the compact inline accordion. Bare mode drops the
  // preview's own card chrome when it already sits inside a card (reading pane).
  const mh = tall ? 'max-h-[62vh]' : undefined;
  return realSheet ? (
    <SpreadsheetPreview url={blob!.url} totalRows={file.rows ?? undefined} maxHeightClass={mh} bare={bare} />
  ) : realPdf ? (
    <PdfCanvasViewer source={blob!.url} fileName={file.name} bare={bare} />
  ) : isPdf ? (
    <SamplePdfPreview file={file} bare={bare} />
  ) : (
    <SampleSheetPreview file={file} maxHeightClass={mh} bare={bare} />
  );
}

// Format identity, shared by the table rows and the preview headers. One calm
// brand tile tone for every file so the icon frame reads the same everywhere in
// the Knowledge Hub; the glyph distinguishes type by SHAPE (sheet vs document),
// not colour.
function fileTile(file: DatasetFile): { Icon: React.ElementType; tone: string } {
  const isSheet = file.format === 'CSV' || file.format === 'XLSX';
  return {
    Icon: isSheet ? Table2 : FileText,
    tone: 'bg-brand-50 text-brand-700',
  };
}

// Flat status pill — design-system correct: tinted bg + label, no icon.
function StatusPillFlat({ status }: { status: FileStatus }) {
  const tone = status === 'processed' ? 'bg-compliant-50 text-compliant-700'
    : status === 'processing' ? 'bg-evidence-50 text-evidence-700'
    : 'bg-risk-50 text-risk-700';
  return (
    <span className={`shrink-0 inline-flex items-center px-2 h-5 rounded-full text-[0.6875rem] font-semibold ${tone}`}>
      {STATUS_META[status].label}
    </span>
  );
}

// ─── Folder view: finder list (left rail of the reading pane) ─────────────────
// Selecting a row (click or ↑/↓) drives the live preview on the right — no
// opening, no back. Rows are dense + file-forward (name + one quiet meta line).
function FileList({ visible, uploadingFiles, search, selectedId, onSelect }: {
  visible: DatasetFile[];
  uploadingFiles: UploadingFile[];
  search: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="py-1.5">
      <AnimatePresence initial={false}>
        {uploadingFiles.map(uf => (<UploadingListRow key={uf.id} file={uf} />))}
      </AnimatePresence>
      {visible.length === 0 && uploadingFiles.length === 0 ? (
        <li className="text-center py-16 px-4">
          <Search size={20} className="mx-auto text-ink-400 mb-2" />
          <p className="text-[0.8125rem] text-ink-700 font-medium">No files match “{search}”.</p>
          <p className="text-[0.75rem] text-ink-500 mt-0.5">Try a different name or clear the search.</p>
        </li>
      ) : (
        visible.map(f => (
          <FileListRow key={f.id} file={f} selected={selectedId === f.id} onSelect={() => onSelect(f.id)} />
        ))
      )}
    </ul>
  );
}

// Dense, flat, tool-like row (Linear/Notion): a small inline file-type icon, the
// name, and one right-aligned tabular signal (row/page count). No tile, no
// gutter. Cool-gray hover/selection; brand-600 is reserved for the selected
// state — a thin left accent + the icon. Size/date drop here (identical across
// opaque dumps, shown in full in the preview header) to keep the scan clean.
function FileListRow({ file, selected, onSelect }: { file: DatasetFile; selected: boolean; onSelect: () => void }) {
  const { Icon } = fileTile(file);
  const signal = file.rows != null
    ? `${file.rows.toLocaleString()} ${file.rows === 1 ? 'row' : 'rows'}`
    : file.pages != null
      ? `${file.pages} ${file.pages === 1 ? 'page' : 'pages'}`
      : formatBytes(file.sizeBytes);

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        data-file-id={file.id}
        onClick={onSelect}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
        aria-pressed={selected}
        title={file.name}
        className={`no-focus-ring group flex items-center gap-2 pl-2.5 pr-2.5 h-8 border-l-2 transition-colors cursor-pointer outline-none ${selected ? 'border-brand-600' : 'border-transparent hover:bg-canvas-border/30 focus-visible:bg-canvas-border/30'}`}
      >
        <Icon size={15} className={`shrink-0 transition-colors ${selected ? 'text-brand-600' : 'text-ink-400 group-hover:text-ink-600'}`} />
        <span className={`flex-1 min-w-0 truncate text-[0.8125rem] ${selected ? 'text-ink-900 font-semibold' : 'text-ink-700 font-medium'}`}>{file.name}</span>
        {file.status === 'processed'
          ? <span className={`shrink-0 text-[0.6875rem] tabular-nums ${selected ? 'text-ink-500' : 'text-ink-400'}`}>{signal}</span>
          : <StatusPillFlat status={file.status} />}
      </div>
    </li>
  );
}

// Uploading file as a list row, with a progress bar under the name.
function UploadingListRow({ file }: { file: UploadingFile }) {
  return (
    <motion.li
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className="overflow-hidden"
    >
      <div className="flex items-center gap-2.5 px-2.5 h-[3.5rem] rounded-lg bg-brand-50/40">
        <span className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 bg-brand-50 text-brand-700"><FileText size={16} /></span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[0.875rem] font-semibold text-ink-900">{file.name}</span>
            <span className="shrink-0 text-[0.75rem] text-evidence-700 tabular-nums">{file.progress}%</span>
          </div>
          <div className="mt-1.5 h-1 rounded-full bg-paper-100 overflow-hidden">
            <motion.div className="h-full bg-brand-600" initial={{ width: 0 }} animate={{ width: `${file.progress}%` }} transition={{ duration: 0.18, ease: 'linear' }} />
          </div>
        </div>
      </div>
    </motion.li>
  );
}

// A Notion-style properties block under the preview. Fills the space below a
// small file with useful, scannable metadata instead of an empty pane — values
// come straight off the file record (no re-parsing). One key/value per row,
// muted label left, tabular value right, hairline-divided card (crisp/flat).
// The shared file-preview body: just the preview card. Used by BOTH a
// standalone single-file source and the folder reading-pane's right side, so
// the two render identically (one component, not two).
function FilePreviewBlock({ file }: { file: DatasetFile }) {
  return <FilePreviewBody key={file.id} file={file} tall />;
}

// ─── Reading pane: live preview (right side) ─────────────────────────────────
// Shows whichever file is selected in the list. Updates instantly as selection
// changes — no opening, no back. The header mirrors the single-file page header
// (brand tile + name + status + download); the body is the shared preview block.
function PreviewPane({ file }: { file: DatasetFile }) {
  const { addToast } = useToast();
  const { Icon } = fileTile(file);
  const isFailed = file.status === 'failed';
  const dateStr = new Date(file.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <>
      <header className="flex items-center gap-3 px-4 h-16 border-b border-canvas-border bg-canvas-elevated shrink-0">
        <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0"><Icon size={20} className="text-brand-700" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[1rem] font-semibold tracking-tight text-ink-900 truncate" title={file.name}>{file.name}</span>
            <StatusPillFlat status={file.status} />
          </div>
          <div className="text-[0.75rem] text-ink-500 tabular-nums mt-0.5">{file.format} · uploaded {dateStr}</div>
        </div>
        {!isFailed && (
          <button
            onClick={() => { triggerDownload(file); addToast({ type: 'success', message: `Downloading ${file.name}…` }); }}
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors cursor-pointer shrink-0"
            aria-label="Download"
            title="Download"
          >
            <Download size={17} />
          </button>
        )}
      </header>
      {isFailed ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6">
          <AlertCircle size={24} className="text-risk" />
          <p className="text-[0.8125rem] text-ink-700 font-medium">Processing failed</p>
          <p className="text-[0.75rem] text-ink-500">This file couldn’t be processed — the format may not be supported.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto p-4">
          <FilePreviewBlock file={file} />
        </div>
      )}
    </>
  );
}

// ─── File row ────────────────────────────────────────────────────────────────

interface FileRowProps {
  file: DatasetFile;
  expanded: boolean;
  isSingle: boolean;
  onToggle: () => void;
  onRename?: (id: string, newName: string) => void;
}

function FileRow({ file, expanded, isSingle, onToggle, onRename }: FileRowProps) {
  const { addToast } = useToast();
  const [editing, setEditing] = useState(false);

  const startRename = () => setEditing(true);

  const handleDownload = () => {
    triggerDownload(file);
    addToast({ type: 'success', message: `Downloading ${file.name}…` });
  };

  const isFailed = file.status === 'failed';
  const countLabel = file.pages != null
    ? `${file.pages} ${file.pages === 1 ? 'page' : 'pages'}`
    : file.rows != null
      ? `${file.rows.toLocaleString()} ${file.rows === 1 ? 'row' : 'rows'}`
      : null;

  const metaLine = (
    <div className="text-[0.75rem] text-ink-500 mt-0.5 tabular-nums">
      {formatBytes(file.sizeBytes)}
      {countLabel && <> · {countLabel}</>}
      <> · uploaded {new Date(file.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
    </div>
  );

  // Inline preview (single-file source path) — reuses the shared body.
  const previewBlock = (
    <div className="px-6 pb-3 pt-0">
      <FilePreviewBody file={file} />
    </div>
  );

  // Single-file source: the page header already carries the icon, name, and
  // "FORMAT · size", so the row would just repeat them. Show only the bits the
  // header lacks — status, row/page count, upload date, download — then the
  // always-open preview.
  if (isSingle) {
    // The page header already shows status · size · upload date + download, so
    // the body is the preview card + the same Details block the folder preview
    // pane uses — kept identical so a single file and a file inside a folder
    // read the same on the right.
    return (
      <li>
        {isFailed ? (
          <>
            <div className="pb-3 text-[0.75rem] text-risk-700">Processing failed. Format may not be supported.</div>
            <FilePreviewBody file={file} tall />
          </>
        ) : (
          <FilePreviewBlock file={file} />
        )}
      </li>
    );
  }

  return (
    <li className="group">
      <div className={`flex items-center gap-3 px-6 py-3 transition-colors ${expanded ? 'bg-canvas' : 'hover:bg-canvas'}`}>
        <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
          <FileText size={18} className="text-brand-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {editing ? (
              <InlineRename
                initial={file.name}
                size="sm"
                onCommit={n => { onRename?.(file.id, n); setEditing(false); }}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <span
                role="button"
                tabIndex={0}
                onClick={onToggle}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
                className="text-[0.875rem] font-semibold text-ink-900 truncate group-hover:text-brand-700 transition-colors cursor-pointer"
                title={file.name}
              >
                {file.name}
              </span>
            )}
            {!editing && <StatusPillFlat status={file.status} />}
          </div>
          {metaLine}
          {isFailed && (
            <div className="text-[0.75rem] text-risk-700 mt-0.5">Processing failed. Format may not be supported.</div>
          )}
        </div>
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
          {onRename && !editing && (
            <button
              onClick={startRename}
              className="flex items-center justify-center w-8 h-8 text-ink-400 hover:text-brand-700 hover:bg-canvas-elevated rounded-md transition-opacity cursor-pointer opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
              aria-label={`Rename ${file.name}`}
              title="Rename"
            >
              <Pencil size={14} />
            </button>
          )}
          {!isFailed && (
            <button
              onClick={handleDownload}
              className="flex items-center justify-center w-8 h-8 text-ink-500 hover:text-brand-700 hover:bg-canvas-elevated rounded-md transition-colors cursor-pointer"
              aria-label={`Download ${file.name}`}
              title="Download"
            >
              <Download size={15} />
            </button>
          )}
          <button
            onClick={onToggle}
            className="flex items-center gap-1 px-2 py-1.5 text-[0.75rem] font-medium text-ink-500 hover:text-brand-700 hover:bg-canvas-elevated rounded-md transition-colors cursor-pointer"
            aria-expanded={expanded}
          >
            View preview
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
            {previewBlock}
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
    <div className="grid grid-cols-[180px_1fr_auto] items-center gap-3 px-5 py-2.5 hover:bg-brand-50/60 transition-colors">
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
