import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  ChevronLeft, ChevronRight, Search, ChevronDown, ArrowUpDown,
  FileText, FolderOpen, Database, MessageSquare,
  Loader2, AlertCircle, AlertOctagon, Pencil, Check, X, Upload,
  Eye, EyeOff, Copy, Mail, Plus, RotateCcw, Download, Table2, List,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import { useCan } from '../../context/CurrentUserContext';
import { Button } from '../shared/Button';
import InlineRename from '../shared/InlineRename';
import FloatingLines from '../shared/FloatingLines';
import ConfirmationModal from '../shared/ConfirmationModal';
import SourceMemoryPanel from '../shared/memory/SourceMemoryPanel';
import {
  filesForSource, getFileBlob, loadFileBlob, registerFileBlob, setSourceFiles, metaForFormat, countPdfPages, countSheetRows, getPdfjs,
  validateUploadFile, isAllowedKnowledgeFile, KH_ALLOWED_LABEL, KH_ALLOWED_ACCEPT,
  INTEGRATION_CONFIGS, formatBytes,
  type DatasetFile, type FileStatus, type FileFormat, type IntegrationConfig,
} from './datasetFiles';
import { TODAY } from './sources';

type SourceType = 'file' | 'database' | 'session';

interface DataSource {
  id: string;
  name: string;
  type: SourceType;
  subtype: string;
  createdAt: string;
  /** Optional override for the date shown on the card (mirrors the canonical
   *  DataSource in sources.ts). */
  displayDate?: string;
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

// SourceType no longer carries 'api' or 'cloud' — the Hub connects files,
// databases and chat-session uploads.
const TYPE_ICON: Record<SourceType, React.ElementType> = {
  file: FileText, database: Database, session: MessageSquare,
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

// Returns a name that doesn't collide with `taken` (case-insensitive) by
// appending " (1)", " (2)", … before the extension. "report.csv" -> "report (1).csv".
function suffixedName(name: string, taken: Set<string>): string {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let i = 1;
  let candidate = `${base} (${i})${ext}`;
  while (taken.has(candidate.toLowerCase())) { i += 1; candidate = `${base} (${i})${ext}`; }
  return candidate;
}

export default function DataSourceDetailView({ source, onBack, onRename, startRenaming, onStartRenamingConsumed }: Props) {
  const { addToast } = useToast();
  const { can } = useCan();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('uploaded');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedFileId, setExpandedFileId] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  // Pending same-name uploads awaiting the user's keep-both confirmation.
  const [dupPrompt, setDupPrompt] = useState<{ items: { file: File; name: string }[]; names: string[] } | null>(null);
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
  // A lone file fills the body (like the folder reading pane) so a wide table
  // scrolls inside a full-height frame instead of being clipped at a short card.
  const singleFile = isFileSource && !source.isFolder && allFiles.length === 1;

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
    if (!can('ds_rename')) { cancelRename(); return; }
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
    if (!can('ds_rename')) return;
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

  // Drives the simulated upload progress + promote for a batch of validated
  // files, using the provided display name (which may carry a " (n)" suffix
  // when the user kept a same-named file alongside the original).
  const startUploads = (items: { file: File; name: string }[]) => {
    const incoming: UploadingFile[] = items.map((it, i) => {
      const ext = it.name.split('.').pop()?.toUpperCase() ?? 'PDF';
      const format: FileFormat = (['PDF', 'CSV', 'XLSX'] as FileFormat[]).includes(ext as FileFormat)
        ? (ext as FileFormat)
        : 'PDF';
      return {
        id: `up-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        name: it.name,
        format,
        sizeBytes: it.file.size,
        progress: 0,
        file: it.file,
      };
    });
    setUploadingFiles(prev => [...incoming, ...prev]);

    incoming.forEach(uf => {
      const tickMs = 90;
      const step = 6 + Math.round(Math.random() * 8); // 6-14% per tick
      const t = setInterval(() => {
        setUploadingFiles(prev => {
          const next = prev.map(p => p.id === uf.id ? { ...p, progress: Math.min(100, p.progress + step) } : p);
          const updated = next.find(p => p.id === uf.id);
          if (updated && updated.progress >= 100) {
            clearInterval(t);
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

  const handleFiles = async (fileList: FileList | null) => {
    if (!can('ds_upload')) return;
    if (!fileList || fileList.length === 0) return;

    // Only PDF/CSV/XLSX, and each must pass content validation before it adds.
    const all = Array.from(fileList);
    const typed = all.filter(f => isAllowedKnowledgeFile(f.name));
    const skippedType = all.length - typed.length;
    if (skippedType > 0) {
      addToast({ type: 'info', message: `${skippedType} file${skippedType > 1 ? 's' : ''} skipped — supported types: ${KH_ALLOWED_LABEL}.` });
    }
    if (typed.length === 0) return;

    const checked = await Promise.all(typed.map(async f => ({ f, res: await validateUploadFile(f) })));
    const accepted: File[] = [];
    for (const { f, res } of checked) {
      if (res.ok) accepted.push(f);
      else addToast({ type: 'error', message: `${f.name} — ${res.reason}` });
    }
    if (accepted.length === 0) return;

    // Split into new names vs duplicates of a file already here (or mid-upload).
    // Fresh files upload immediately; duplicates wait for a keep-both confirm,
    // then upload with a " (n)" suffix so the original is never overwritten.
    const taken = new Set<string>([
      ...allFiles.map(f => f.name.toLowerCase()),
      ...uploadingFiles.map(f => f.name.toLowerCase()),
    ]);
    const fresh: { file: File; name: string }[] = [];
    const dupes: { file: File; name: string }[] = [];
    for (const f of accepted) {
      if (taken.has(f.name.toLowerCase())) {
        const name = suffixedName(f.name, taken);
        taken.add(name.toLowerCase());
        dupes.push({ file: f, name });
      } else {
        taken.add(f.name.toLowerCase());
        fresh.push({ file: f, name: f.name });
      }
    }
    if (fresh.length) startUploads(fresh);
    if (dupes.length) setDupPrompt({ items: dupes, names: dupes.map(d => d.file.name) });
  };

  // Keep both: upload the duplicates under their suffixed names.
  const confirmKeepBoth = () => {
    if (dupPrompt) startUploads(dupPrompt.items);
    setDupPrompt(null);
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
          className="flex items-center gap-1 px-2 py-1 text-[0.75rem] font-medium text-ink-500 hover:text-brand-700 hover:bg-canvas rounded-md transition-colors cursor-pointer"
        >
          <ChevronLeft size={14} />
          Data Sources
        </button>
      </div>

      {/* Source header — gradient hero matching the report header: purple
          gradient + masked FloatingLines texture, white text. */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.2, 0, 0, 1], delay: 0.04 }}
        className="relative overflow-hidden shrink-0 rounded-xl bg-gradient-to-br from-[#3b0b72] to-[#6a12cd]"
      >
        <div className="absolute inset-0 z-0" style={{ maskImage: 'linear-gradient(to right, transparent 35%, white 70%)', WebkitMaskImage: 'linear-gradient(to right, transparent 35%, white 70%)' }}>
          <FloatingLines enabledWaves={['top', 'middle']} lineCount={6} lineDistance={6} bendRadius={4} bendStrength={-0.3} interactive={false} parallax={false} color="#e879f9" opacity={0.3} />
        </div>
        <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap px-5 py-4">
        <div className="group/hd flex items-center gap-3.5 min-w-0 flex-1">
          <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <SourceIcon size={22} className="text-white" />
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
                    // Match the <h1>'s line height (no fixed h-10) so entering
                    // edit mode doesn't grow the header card. -my-px + box-border
                    // absorbs the 1px border into the title's own line box.
                    className="-my-px box-border h-[1.5rem] px-2 text-[1.125rem] leading-none font-semibold tracking-tight text-ink-900 bg-canvas-elevated border border-brand-600 rounded-md focus:outline-none min-w-0 flex-1"
                  />
                  <button
                    onClick={commitRename}
                    className="-my-px p-1 text-white hover:bg-white/15 rounded-md transition-colors cursor-pointer"
                    aria-label="Save name"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onMouseDown={() => { suppressBlurCommitRef.current = true; }}
                    onClick={cancelRename}
                    className="-my-px p-1 text-white/70 hover:bg-white/15 rounded-md transition-colors cursor-pointer"
                    aria-label="Cancel rename"
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <h1
                    onClick={startRename}
                    title="Rename source"
                    className="text-[1.125rem] font-semibold tracking-tight text-white truncate cursor-pointer hover:text-white/80 transition-colors"
                  >
                    {source.name}
                  </h1>
                  <button
                    onClick={startRename}
                    className="p-1 text-white/60 hover:text-white hover:bg-white/15 rounded-md transition-colors cursor-pointer shrink-0 opacity-0 group-hover/hd:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
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
            <div className="flex items-center gap-2 mt-2 text-[0.8125rem] text-white/70 tabular-nums">
              <span className="inline-flex items-center shrink-0 px-1.5 h-[1.125rem] rounded-md bg-white/15 text-[0.625rem] font-bold uppercase tracking-wide text-white">
                {source.isFolder ? 'Folder' : isFileSource ? (headerFile?.format ?? source.subtype.split('·')[0].trim()) : source.type}
              </span>
              <span className="truncate">
                {source.isFolder
                  // Folders: count + total size.
                  ? `${allFiles.length} ${allFiles.length === 1 ? 'file' : 'files'} · ${formatBytes(totalSize)} · uploaded ${new Date(source.displayDate ?? source.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                  : isFileSource && headerFile
                    // Single file: size · upload date (format is the chip).
                    ? <>{formatBytes(headerFile.sizeBytes)} · uploaded {new Date(headerFile.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
                    : <>{source.subtype}{integrationConfig && <> · {integrationConfig.provider}</>}</>}
              </span>
              {headerFile && (
                <>
                  <span className="text-white/30">|</span>
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
            className="group shrink-0 flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-b from-white/25 to-white/[0.08] backdrop-blur-md border border-white/30 ring-1 ring-inset ring-white/20 text-white shadow-[0_4px_14px_rgb(15_8_30_/_0.25)] hover:from-white hover:to-white hover:text-brand-700 hover:ring-white/0 hover:shadow-[0_6px_22px_rgb(255_255_255_/_0.30)] active:scale-95 transition-all duration-200 cursor-pointer"
          >
            <Download size={18} className="transition-transform duration-200 group-hover:translate-y-0.5 motion-reduce:transition-none" />
          </button>
        )}
        </div>
      </motion.div>

      {/* ── Source memory — what IRA knows about this table (Memory PRD §6:
          Knowledge Hub manages source memory, and only source memory). Drift
          review surfaces here first, before a run gets hit by it. */}
      <SourceMemoryPanel sourceId={source.id} sourceName={source.name} />

      {/* ── Body branches by source type ── A folder shows the reading pane
          (its own rail/preview scroll internally); everything else fills the
          remaining height and scrolls *inside* this region, so the back link
          and header stay pinned and the page itself never scrolls. */}
      <div className={`flex flex-col min-h-0 flex-1 ${(source.isFolder || singleFile) ? '' : 'overflow-y-auto overflow-x-hidden'}`}>
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

      <ConfirmationModal
        open={dupPrompt !== null}
        tone="primary"
        title={dupPrompt && dupPrompt.names.length === 1 ? 'File already exists' : 'Files already exist'}
        description={dupPrompt && (dupPrompt.names.length === 1
          ? <>A file named <span className="font-semibold text-ink-800">“{dupPrompt.names[0]}”</span> already exists in this folder. Keep both? The new file is added as <span className="font-semibold text-ink-800">“{dupPrompt.items[0].name}”</span>.</>
          : <>{dupPrompt.names.length} files already exist in this folder. Keep both copies? The new ones are added with a “(n)” suffix.</>)}
        confirmLabel="Keep both"
        cancelLabel="Cancel"
        onConfirm={confirmKeepBoth}
        onClose={() => setDupPrompt(null)}
      />
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
    <div className={fill ? 'flex flex-col gap-4 h-full min-h-0' : singlePreview ? 'flex flex-col h-full min-h-0' : 'space-y-4'}>
      {/* Option 1 — the finder controls (search / sort / Add files) no longer
          float in a full-width bar above the panel. They moved into the file
          rail itself (search + sort in its header, Add files pinned to its
          footer), so the control sits with the list it actually drives and the
          reading pane reads as one seamless surface. */}

      {/* Drop zone — wraps the file list */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          onUpload(e.dataTransfer.files);
        }}
        className={`relative transition-colors ${isDragging ? 'rounded-xl overflow-hidden border border-brand-300 bg-brand-50/40' : singlePreview ? '' : 'rounded-xl overflow-hidden border border-canvas-border bg-canvas-elevated shadow-[0_1px_2px_rgb(15_8_30_/_0.04)]'} ${(fill || singlePreview) ? 'flex-1 min-h-0 flex flex-col' : ''}`}
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
                Add files
              </Button>
            </div>
          </div>
        ) : isFolder ? (
          /* Option 2 — folder reading pane with ONE shared header band across
             both columns: rail search + sort on the left segment, the selected
             file's identity on the right segment, all on a single line. The
             body row (list + preview) sits beneath that unbroken band. */
          <div className="flex flex-col flex-1 min-h-0">
            {/* Shared header band */}
            <div className="shrink-0 flex items-stretch h-12 border-b border-canvas-border bg-canvas-elevated">
              {/* Left segment — search + sort (aligns to the rail width). */}
              <div className="w-80 shrink-0 flex items-center gap-2 px-3 border-r border-canvas-border">
                <div className="relative flex-1 min-w-0">
                  <Search size={14} className="absolute left-0 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder="Search files…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="no-focus-ring w-full pl-6 pr-6 h-9 bg-transparent text-[0.8125rem] text-ink-800 placeholder:text-ink-400 focus:outline-none"
                  />
                  {search && (
                    <button
                      onClick={() => { setSearch(''); searchRef.current?.focus(); }}
                      className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded text-ink-400 hover:text-ink-700 transition-colors cursor-pointer"
                      aria-label="Clear search"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                <div className="relative shrink-0">
                  <button
                    onClick={() => setSortOpen(!sortOpen)}
                    title={`Sort: ${activeSort.label}`}
                    aria-label={`Sort: ${activeSort.label}`}
                    className={`no-focus-ring flex items-center justify-center w-8 h-8 rounded-md transition-colors cursor-pointer ${sortOpen ? 'bg-brand-50 text-brand-700' : 'text-ink-400 hover:bg-canvas hover:text-brand-700'}`}
                  >
                    <ArrowUpDown size={14} />
                  </button>
                  {sortOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                      <div className="absolute right-0 top-full mt-1 w-44 z-20 bg-canvas-elevated border border-canvas-border rounded-lg py-1 shadow-md">
                        {SORTS.map(s => {
                          const on = s.key === sortKey && s.dir === sortDir;
                          return (
                            <button
                              key={s.label}
                              onClick={() => { setSortKey(s.key); setSortDir(s.dir); setSortOpen(false); }}
                              className={`w-full text-left px-3 py-1.5 text-[0.8125rem] cursor-pointer transition-colors whitespace-nowrap ${on ? 'text-brand-700 font-semibold bg-brand-50' : 'text-ink-700 hover:bg-canvas'}`}
                            >
                              {s.label}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
              {/* Right segment — the selected file's identity, same line. */}
              <div className="flex-1 min-w-0 flex items-center px-4">
                {selected ? (
                  <PreviewHeaderBar file={selected} />
                ) : (
                  <span className="text-[0.8125rem] text-ink-400">Select a file to preview it.</span>
                )}
              </div>
            </div>

            {/* Body row — file rail (left) + live preview (right). */}
            <div className="flex flex-1 min-h-0">
              <div className="w-80 shrink-0 border-r border-canvas-border flex flex-col min-h-0 bg-canvas-elevated">
                <div ref={listRef} className="flex-1 overflow-y-auto">
                  <FileList
                    visible={visible}
                    uploadingFiles={uploadingFiles}
                    search={search}
                    selectedId={selected?.id ?? null}
                    onSelect={setSelectedId}
                  />
                </div>
                {/* Footer — Add files pinned to the rail bottom. h-10 matches the
                    preview's sheet-tab bar / footer so both columns' bottoms
                    align; px-3 keeps the button clear of the card's rounded
                    bottom-left corner instead of crowding it. */}
                <div className="shrink-0 h-10 px-3 flex items-center border-t border-canvas-border bg-canvas-elevated">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={KH_ALLOWED_ACCEPT}
                    className="hidden"
                    onChange={(e) => { onUpload(e.target.files); e.target.value = ''; }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 h-8 rounded-md bg-brand-600 hover:bg-brand-500 active:bg-brand-800 text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer"
                  >
                    <Plus size={14} />
                    Add files
                  </button>
                </div>
              </div>
              <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-canvas-elevated">
                {selected ? (
                  <PreviewBody file={selected} />
                ) : (
                  <div className="flex-1 flex items-center justify-center text-[0.8125rem] text-ink-400">
                    Select a file to preview it.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Single-file source — one always-open inline preview, no list. The
             preview FILLS the body (like the folder reading pane) so a wide
             table scrolls inside a full-height frame instead of being clipped
             at a short card's right edge. */
          <ul className={singlePreview ? 'flex-1 min-h-0 flex flex-col' : 'divide-y divide-canvas-border'}>
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

// Excel-style bottom tab bar — the sheet switcher lives under the table, so the
// grid stays full-width and there's no second left rail. Tabs scroll
// horizontally; ‹ › step adjacent sheets; the list button opens a searchable
// menu (the answer to a 100-sheet workbook). A compact status sits at the right.
function SheetTabBar({ sheetNames, active, onSelect, trailing }: {
  sheetNames: string[];
  active: number;
  onSelect: (i: number) => void;
  trailing?: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [q, setQ] = useState('');
  const stripRef = useRef<HTMLDivElement>(null);
  const total = sheetNames.length;
  const go = (i: number) => { if (i >= 0 && i < total) onSelect(i); };

  // Keep the active tab in view as it changes (arrows, or a jump from the menu).
  useEffect(() => {
    stripRef.current?.querySelector(`[data-tab="${active}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);

  const results = sheetNames
    .map((name, i) => ({ name, i }))
    .filter(s => !q || s.name.toLowerCase().includes(q.toLowerCase()));
  const ctl = 'flex items-center justify-center w-6 h-6 rounded text-ink-400 transition-colors cursor-pointer hover:bg-canvas hover:text-brand-700 disabled:opacity-30 disabled:pointer-events-none';

  return (
    <div className="shrink-0 flex items-center gap-1 h-10 px-1.5 border-t border-canvas-border bg-canvas">
      <button type="button" className={ctl} onClick={() => go(active - 1)} disabled={active <= 0} aria-label="Previous sheet" title="Previous sheet">
        <ChevronLeft size={14} />
      </button>
      <button type="button" className={ctl} onClick={() => go(active + 1)} disabled={active >= total - 1} aria-label="Next sheet" title="Next sheet">
        <ChevronRight size={14} />
      </button>
      <div className="relative shrink-0">
        <button type="button" className={`${ctl} ${menuOpen ? 'bg-brand-50 text-brand-700' : ''}`} onClick={() => setMenuOpen(o => !o)} aria-label="All sheets" title="All sheets">
          <List size={14} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => { setMenuOpen(false); setQ(''); }} />
            <div className="absolute left-0 bottom-full mb-1 z-20 w-60 bg-canvas-elevated border border-canvas-border rounded-lg shadow-md py-1">
              {total > 8 && (
                <div className="px-2 pt-0.5 pb-1.5">
                  <div className="relative">
                    <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                    <input
                      autoFocus
                      value={q}
                      onChange={e => setQ(e.target.value)}
                      placeholder="Find sheet…"
                      className="no-focus-ring w-full pl-7 pr-2 h-7 rounded-md border border-canvas-border bg-canvas text-[0.75rem] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-300"
                    />
                  </div>
                </div>
              )}
              <div className="max-h-[260px] overflow-y-auto">
                {results.length === 0 ? (
                  <div className="px-3 py-2 text-[0.75rem] text-ink-400">No sheets match “{q}”.</div>
                ) : (
                  results.map(({ name, i }) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { onSelect(i); setMenuOpen(false); setQ(''); }}
                      title={name}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[0.75rem] transition-colors cursor-pointer ${i === active ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-ink-700 hover:bg-canvas'}`}
                    >
                      <span className="shrink-0 w-6 text-[0.625rem] tabular-nums text-ink-300">{i + 1}</span>
                      <span className="truncate">{name}</span>
                      {i === active && <Check size={12} className="ml-auto shrink-0 text-brand-600" />}
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
      <div className="w-px h-4 bg-canvas-border mx-0.5 shrink-0" />
      <div ref={stripRef} className="flex-1 min-w-0 overflow-x-auto flex items-center gap-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sheetNames.map((name, i) => {
          const on = i === active;
          return (
            <button
              key={i}
              type="button"
              data-tab={i}
              onClick={() => onSelect(i)}
              aria-pressed={on}
              title={name}
              className={`shrink-0 inline-flex items-center h-7 px-2.5 rounded-md text-[0.75rem] max-w-[12rem] truncate transition-colors cursor-pointer ${
                on ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-ink-500 hover:text-ink-800 hover:bg-canvas'
              }`}
            >
              <span className="truncate">{name}</span>
            </button>
          );
        })}
      </div>
      {trailing && <div className="shrink-0 ml-1 pl-1">{trailing}</div>}
    </div>
  );
}

// Presentational spreadsheet — sheet bar + row-number gutter + sticky header +
// numeric-aware alignment. Shared by the live (parsed bytes) and sample
// (synthesised, for files with no real bytes) previews.
function SpreadsheetTable({ header, body, totalRows, totalCols, sheetNames, activeSheet = 0, onSelectSheet, maxHeightClass = 'max-h-[360px]', bare = false, fill = false }: {
  header: string[];
  body: string[][];
  totalRows: number;
  totalCols: number;
  sheetNames: string[];
  activeSheet?: number;
  onSelectSheet?: (i: number) => void;
  maxHeightClass?: string;
  bare?: boolean;
  /** Stretch the card to fill its parent's height (reading pane) so a short
   *  sheet doesn't leave a dead zone below it. */
  fill?: boolean;
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

  // The grid is layout-agnostic — build once, reuse under either the single-sheet
  // header or the multi-sheet Excel-style bottom tab bar.
  const tableEl = (
    <table className="border-collapse text-[0.75rem] w-full">
      {/* Sticky is applied to the TH cells (not just <thead>): with
          `border-collapse` some engines ignore sticky on <thead>/<tr>, and the
          shared bottom border can detach on scroll. The inset box-shadow draws
          the bottom hairline on the cell itself so it always travels with the
          pinned header. */}
      <thead className="sticky top-0 z-10">
        <tr>
          {header.map((h, i) => (
            <th
              key={i}
              title={h}
              className={`sticky top-0 z-10 px-3 py-1.5 bg-canvas border-r border-canvas-border shadow-[inset_0_-1px_0_#e5e7eb] text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-500 truncate ${i === flexCol ? 'w-full' : 'min-w-[5rem] max-w-[13rem]'} ${colNumeric[i] ? 'text-right' : 'text-left'}`}
            >
              {h}
            </th>
          ))}
          {/* No prose column to absorb the slack → a blank filler column
              stretches the row to the card's full width (so short-column
              sheets don't leave a dead zone on the right). */}
          {!hasFlex && <th aria-hidden className="sticky top-0 z-10 w-full bg-canvas shadow-[inset_0_-1px_0_#e5e7eb]" />}
        </tr>
      </thead>
      <tbody>
        {body.map((row, r) => (
          <tr key={r} className="group/row border-b border-canvas-border/40 last:border-0 transition-colors hover:bg-canvas">
            {header.map((_, ci) => {
              const v = row[ci] ?? '';
              return (
                <td
                  key={ci}
                  className={`px-3 py-1.5 text-[0.75rem] text-ink-700 border-r border-canvas-border/40 ${ci === flexCol ? 'max-w-0 truncate' : 'max-w-[13rem] truncate'} ${cellAlign(ci)}`}
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
  );

  const footerEl = (
    <div className="px-3 h-10 shrink-0 flex items-center gap-2.5 border-t border-canvas-border bg-canvas text-[0.6875rem] text-ink-500 tabular-nums">
      <span className="font-medium text-ink-600">Showing {body.length} of {totalRows.toLocaleString()}</span>
    </div>
  );

  const dimsEl = (
    <span className="text-[0.6875rem] text-ink-400 tabular-nums shrink-0">
      {totalRows.toLocaleString()} × {totalCols.toLocaleString()}
    </span>
  );

  // Compact status for the right edge of the bottom tab bar (multi-sheet) —
  // just the dimensions; the live/sample indicator is dropped here.
  const statusInline = (
    <span className="inline-flex items-center text-[0.6875rem] tabular-nums text-ink-400 shrink-0">
      <span>{totalRows.toLocaleString()} × {totalCols.toLocaleString()}</span>
    </span>
  );

  return (
    <div className={`${bare ? '' : 'rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden shadow-[0_1px_2px_rgb(15_8_30_/_0.04)]'} ${fill ? 'h-full flex flex-col' : ''}`}>
      {/* Single-sheet keeps a slim top label; multi-sheet drops it so the table
          runs edge-to-edge and the sheets live in the bottom tab bar. */}
      {!multi && (
        <div className="flex items-center justify-between gap-3 px-2 h-10 border-b border-canvas-border bg-canvas shrink-0">
          <span className="inline-flex items-center gap-2 px-1 text-[0.75rem] font-semibold uppercase tracking-wide text-ink-600 truncate">
            <Table2 size={14} className="text-brand-600 shrink-0" />
            {activeName}
          </span>
          {dimsEl}
        </div>
      )}

      {/* A wide table scrolls horizontally with a thin, always-visible scrollbar
          (forced classic via ::-webkit-scrollbar, not the macOS overlay that only
          pops up on hover) so it's clear from the first click that there's more to
          the right — and nothing is obscured by an overlay/fade. */}
      <div className={`overflow-auto kh-table-scroll ${fill ? 'flex-1 min-h-0' : maxHeightClass}`}>{tableEl}</div>

      {multi ? (
        <SheetTabBar sheetNames={sheetNames} active={activeSheet} onSelect={(i) => onSelectSheet?.(i)} trailing={statusInline} />
      ) : (
        footerEl
      )}
    </div>
  );
}

// Table loading skeleton — shown both while the bytes load from IndexedDB AND
// while SheetJS parses them, so it's ONE continuous skeleton (never the wrong
// sample table flashing first). Reserves the exact footprint the loaded table
// will occupy — column-header + filling/clipped rows + bottom bar — so the swap
// to real data happens in place: no height jump, no scrollbar appearing.
function TableSkeleton({ fill = false, bare = false, maxHeightClass }: { fill?: boolean; bare?: boolean; maxHeightClass?: string }) {
  const shellClass = bare ? '' : 'rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden shadow-[0_1px_2px_rgb(15_8_30_/_0.04)]';
  const dataArea = fill
    ? 'flex-1 min-h-0'
    : (maxHeightClass ?? '').includes('62vh')
      ? 'h-[62vh]'
      : 'h-[360px]';
  return (
    <div className={`${shellClass} ${fill ? 'h-full flex flex-col' : 'flex flex-col'}`}>
      <div className="shrink-0 flex items-center gap-4 px-3 h-10 border-b border-canvas-border bg-canvas">
        <span className="h-2.5 w-20 rounded skeleton-cool shrink-0" />
        <span className="h-2.5 flex-1 rounded skeleton-cool" />
        <span className="h-2.5 w-16 rounded skeleton-cool shrink-0" />
        <span className="h-2.5 w-20 rounded skeleton-cool shrink-0" />
        <span className="h-2.5 w-16 rounded skeleton-cool shrink-0" />
      </div>
      <div className={`${dataArea} overflow-hidden px-3 py-2.5 space-y-3`}>
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <span className="h-3 w-20 rounded skeleton-cool shrink-0" />
            <span className="h-3 flex-1 rounded skeleton-cool" />
            <span className="h-3 w-16 rounded skeleton-cool shrink-0" />
            <span className="h-3 w-20 rounded skeleton-cool shrink-0" />
            <span className="h-3 w-16 rounded skeleton-cool shrink-0" />
          </div>
        ))}
      </div>
      <div className="shrink-0 h-10 border-t border-canvas-border bg-canvas flex items-center gap-2.5 px-3">
        <span className="h-3 w-14 rounded skeleton-cool" />
        <span className="h-3 w-14 rounded skeleton-cool" />
        <span className="h-3 w-14 rounded skeleton-cool" />
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

function SpreadsheetPreview({ url, totalRows, maxHeightClass, bare = false, fill = false }: { url: string; totalRows?: number; maxHeightClass?: string; bare?: boolean; fill?: boolean }) {
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  // Every sheet is extracted up front into state, so switching is just an index
  // change — it never reaches back into a parsed-workbook ref that could be
  // empty (that desync was the "tabs don't switch" bug). Preview slices are
  // tiny (first rows × cols), so extracting all sheets once is cheap.
  const [sheets, setSheets] = useState<{ rows: string[][]; total: number; cols: number }[] | null>(null);
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const buf = await (await fetch(url)).arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array', cellDates: true });
        if (cancelled) return;
        const all = wb.SheetNames.map((_, i) => extractSheet(wb, i));
        setSheetNames(wb.SheetNames);
        setSheets(all);
        setActive(0);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  const data = sheets ? (sheets[active] ?? sheets[0] ?? null) : null;
  const selectSheet = (i: number) => {
    if (sheets && i >= 0 && i < sheets.length) setActive(i);
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
    return <TableSkeleton fill={fill} bare={bare} maxHeightClass={maxHeightClass} />;
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
      fill={fill}
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
function SampleSheetPreview({ file, maxHeightClass, bare = false, fill = false }: { file: DatasetFile; maxHeightClass?: string; bare?: boolean; fill?: boolean }) {
  const url = file.format === 'CSV' ? SAMPLE_ASSETS.csv : SAMPLE_ASSETS.xlsx;
  return <SpreadsheetPreview url={url} maxHeightClass={maxHeightClass} bare={bare} fill={fill} />;
}

// Renders one real PDF page to a canvas via pdf.js, scaled to targetWidth.
function PdfCanvas({ doc, pageNumber, targetWidth, fit }: { doc: PDFDocumentProxy; pageNumber: number; targetWidth?: number; fit?: { w: number; h: number } }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    (async () => {
      const pageObj = await doc.getPage(pageNumber);
      if (cancelled || !ref.current) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const base = pageObj.getViewport({ scale: 1 });
      // `fit` = scale the page to the pane WIDTH (edge-to-edge); a tall page then
      // overflows vertically and scrolls. `targetWidth` = fixed width (thumbnails).
      // CSS size = device px / dpr.
      const cssScale = fit
        ? fit.w / base.width
        : (targetWidth ?? base.width) / base.width;
      const viewport = pageObj.getViewport({ scale: cssScale * dpr });
      const canvas = ref.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / dpr}px`;
      canvas.style.height = `${viewport.height / dpr}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      task = pageObj.render({ canvas, canvasContext: ctx, viewport });
      try { await task.promise; } catch { /* cancelled */ }
    })();
    return () => { cancelled = true; try { task?.cancel(); } catch { /* noop */ } };
  }, [doc, pageNumber, targetWidth, fit?.w, fit?.h]);
  return <canvas ref={ref} className="block" />;
}

// The page-by-page PDF viewer: a thumbnail rail + the active page, both rendered
// as REAL PDF pages (pdf.js → canvas). Used for uploaded files (their bytes) and
// for demo files (a generated PDF) alike — so it's always a real PDF render.
function PdfCanvasViewer({ source, fileName, bare = false, fill = false }: { source: string | Blob; fileName: string; bare?: boolean; fill?: boolean }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [failed, setFailed] = useState(false);
  // Live size of the active-page pane, so the page renders to FILL it (contain
  // fit) rather than at a fixed small width that floats like a card inside the
  // viewer. Re-measured on resize.
  const pageAreaRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = pageAreaRef.current;
    if (!el) return;
    const measure = () => setArea({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc]);

  // Page aspect ratio (from page 1) so every slot in the continuous scroll gets a
  // correct height BEFORE its canvas renders — keeps the scroll position stable.
  const [aspect, setAspect] = useState(1.294);
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    doc.getPage(1).then(p => {
      if (cancelled) return;
      const vp = p.getViewport({ scale: 1 });
      if (vp.width > 0) setAspect(vp.height / vp.width);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [doc]);

  // Continuous-scroll plumbing: each page is a fixed-height slot, but only pages
  // near the active one render a real canvas (windowed) so a 100-page doc stays
  // light. Scrolling syncs the active page; clicks smooth-scroll to a page.
  const SLOT_GAP = 16;
  const pageSlotRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const programmaticRef = useRef(false);
  // Thumbnail rail follows the active page: as the main view scrolls (or an
  // arrow/thumbnail click moves the page), keep the active thumbnail in view so
  // the rail and the page scroll stay in sync.
  const railRef = useRef<HTMLDivElement>(null);
  const activeThumbRef = useRef<HTMLButtonElement | null>(null);
  // Edge-to-edge: each page fills the full pane width (the [scrollbar-gutter:
  // stable] pane already excludes the scrollbar, so no extra inset is needed).
  const pageW = Math.max(0, area.w);
  const slotH = Math.round(pageW * aspect);

  // Scroll → active page (skipped while a click-driven smooth scroll is running).
  const onPageScroll = () => {
    if (programmaticRef.current) return;
    const el = pageAreaRef.current;
    if (!el || slotH <= 0) return;
    const next = Math.min(numPages, Math.max(1, Math.round(el.scrollTop / (slotH + SLOT_GAP)) + 1));
    setPage(p => (p === next ? p : next));
  };

  // Click a thumbnail / arrow → smooth-scroll that page into view.
  const scrollToPage = (p: number) => {
    const target = Math.min(numPages, Math.max(1, p));
    setPage(target);
    const el = pageAreaRef.current;
    const slot = pageSlotRefs.current[target];
    if (!el || !slot) return;
    programmaticRef.current = true;
    el.scrollTo({ top: slot.offsetTop - SLOT_GAP, behavior: 'smooth' });
    window.setTimeout(() => { programmaticRef.current = false; }, 450);
  };

  // Keep the active thumbnail visible in the rail whenever the page changes —
  // whether driven by scrolling the main view or by an arrow/thumbnail click.
  useEffect(() => {
    const rail = railRef.current;
    const thumb = activeThumbRef.current;
    if (!rail || !thumb) return;
    const top = thumb.offsetTop;
    const bottom = top + thumb.offsetHeight;
    if (top < rail.scrollTop) {
      rail.scrollTo({ top: top - 10, behavior: 'smooth' });
    } else if (bottom > rail.scrollTop + rail.clientHeight) {
      rail.scrollTo({ top: bottom - rail.clientHeight + 10, behavior: 'smooth' });
    }
  }, [page]);

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
        Preview unavailable
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
    <div className={`overflow-hidden flex flex-col ${fill ? 'h-full min-h-0' : ''} ${bare ? '' : 'rounded-xl border border-canvas-border bg-canvas-elevated shadow-[0_1px_2px_rgb(15_8_30_/_0.04)]'}`}>
      <div className={`flex ${fill ? 'flex-1 min-h-0' : 'h-[440px]'} bg-canvas`}>
        {/* Thumbnail rail — real rendered page images. Always shown (even for a
            single page) so the document viewer reads the same regardless of
            page count. */}
        <div ref={railRef} className="w-[116px] shrink-0 border-r border-canvas-border bg-canvas-elevated overflow-y-auto p-2.5 space-y-2.5">
          {Array.from({ length: numPages }, (_, idx) => idx + 1).map(i => (
            <button
              key={i}
              ref={i === page ? activeThumbRef : undefined}
              type="button"
              onClick={() => scrollToPage(i)}
              className="block w-full group cursor-pointer"
              aria-label={`Page ${i}`}
              aria-current={i === page}
            >
              <div className={`rounded-xs border bg-white overflow-hidden transition-shadow ${i === page ? 'border-brand-400 ring-2 ring-brand-200 shadow-sm' : 'border-canvas-border group-hover:border-brand-300'}`}>
                <PdfCanvas doc={doc} pageNumber={i} targetWidth={92} />
              </div>
              <div className={`mt-1 text-center text-[0.625rem] tabular-nums ${i === page ? 'text-brand-700 font-semibold' : 'text-ink-400'}`}>{i}</div>
            </button>
          ))}
        </div>

        {/* Active pages — continuous vertical scroll through the whole document.
            Each page contain-fits the pane width; scrolling moves between pages
            and syncs the footer + the highlighted thumbnail. Only pages near the
            active one render a canvas (windowed) so a 100-page doc stays light. */}
        <div ref={pageAreaRef} onScroll={onPageScroll} className="flex-1 min-w-0 overflow-auto [scrollbar-gutter:stable]">
          {area.w > 0 && slotH > 0 && (
            <div className="flex flex-col items-center py-4" style={{ gap: SLOT_GAP }}>
              {Array.from({ length: numPages }, (_, idx) => idx + 1).map(p => (
                <div
                  key={p}
                  ref={el => { pageSlotRefs.current[p] = el; }}
                  style={{ width: pageW, height: slotH }}
                  className="shrink-0 bg-white overflow-hidden shadow-[0_1px_3px_rgb(15_8_30_/_0.06)]"
                >
                  {Math.abs(p - page) <= 2 && <PdfCanvas doc={doc} pageNumber={p} fit={{ w: pageW, h: slotH }} />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-1.5 px-3 h-10 border-t border-canvas-border bg-canvas-elevated">
        <button
          type="button"
          disabled={page === 1}
          onClick={() => scrollToPage(page - 1)}
          className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors ${page === 1 ? 'text-ink-300 cursor-not-allowed' : 'text-ink-500 hover:text-brand-700 hover:bg-canvas cursor-pointer'}`}
          aria-label="Previous page"
        >
          <ChevronLeft size={15} />
        </button>
        <span className="text-[0.75rem] text-ink-600 tabular-nums">Page <span className="font-semibold text-ink-800">{page}</span> of {numPages}</span>
        <button
          type="button"
          disabled={page === numPages}
          onClick={() => scrollToPage(page + 1)}
          className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors ${page === numPages ? 'text-ink-300 cursor-not-allowed' : 'text-ink-500 hover:text-brand-700 hover:bg-canvas cursor-pointer'}`}
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
function SamplePdfPreview({ file, bare = false, fill = false }: { file: DatasetFile; bare?: boolean; fill?: boolean }) {
  return <PdfCanvasViewer source={SAMPLE_ASSETS.pdf} fileName={file.name} bare={bare} fill={fill} />;
}

// Resolves a file's real bytes for preview: instant for files uploaded this
// session (in-memory), or rehydrated from IndexedDB after a reload. Returns
// undefined until/unless real bytes exist (seed files stay undefined → mock).
function useFileBlob(fileId: string) {
  // `loading` is true while the bytes are being fetched from IndexedDB. The
  // preview uses it to hold a skeleton instead of briefly rendering the wrong
  // sample table (which caused a flash of mismatched content + a layout shift
  // when the real bytes arrived).
  const [state, setState] = useState<{ blob: { url: string; mime: string } | undefined; loading: boolean }>(() => {
    const mem = getFileBlob(fileId);
    return { blob: mem, loading: mem === undefined };
  });
  useEffect(() => {
    const mem = getFileBlob(fileId);
    if (mem) { setState({ blob: mem, loading: false }); return; }
    setState({ blob: undefined, loading: true });
    let cancelled = false;
    // The loading state MUST always resolve. If rehydrating the bytes fails
    // (corrupt persisted entry, IndexedDB blocked/unavailable, a createObjectURL
    // throw) the preview has to fall back to the mock sample — never sit on the
    // skeleton forever. `.catch` covers a rejected load; the timeout is the last
    // backstop for the pathological case where the request never settles at all.
    const settle = (blob: { url: string; mime: string } | undefined) => {
      if (!cancelled) setState({ blob, loading: false });
    };
    const timer = window.setTimeout(() => settle(undefined), 8000);
    loadFileBlob(fileId)
      .then(b => { window.clearTimeout(timer); settle(b ?? undefined); })
      .catch(() => { window.clearTimeout(timer); settle(undefined); });
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [fileId]);
  return state;
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
function FilePreviewBody({ file, tall = false, bare = false, fill = false }: { file: DatasetFile; tall?: boolean; bare?: boolean; fill?: boolean }) {
  const isPdf = file.pages != null;
  const { blob, loading } = useFileBlob(file.id);
  const realPdf = isPdf && !!blob && (blob.mime === 'application/pdf' || file.format === 'PDF');
  const realSheet = !isPdf && !!blob;
  // Tall mode (split pane / full-screen) lets sheet tables use far more
  // vertical room than the compact inline accordion. Bare mode drops the
  // preview's own card chrome when it already sits inside a card (reading pane).
  const mh = tall ? 'max-h-[62vh]' : undefined;
  // While the bytes are still loading from IndexedDB, hold the skeleton for
  // spreadsheets so we never flash the bundled sample table first (the source
  // of the "placement changes after some time" jump + the wide-table scroll).
  if (loading && !isPdf) {
    return <TableSkeleton fill={fill} bare={bare} maxHeightClass={mh} />;
  }
  return realSheet ? (
    <SpreadsheetPreview url={blob!.url} totalRows={file.rows ?? undefined} maxHeightClass={mh} bare={bare} fill={fill} />
  ) : realPdf ? (
    <PdfCanvasViewer source={blob!.url} fileName={file.name} bare={bare} fill={fill} />
  ) : isPdf ? (
    <SamplePdfPreview file={file} bare={bare} fill={fill} />
  ) : (
    <SampleSheetPreview file={file} maxHeightClass={mh} bare={bare} fill={fill} />
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
        className={`no-focus-ring group flex items-center gap-2.5 pl-2.5 pr-2.5 h-9 border-l-2 transition-colors cursor-pointer outline-none ${selected ? 'border-brand-600 bg-brand-50' : 'border-transparent hover:bg-canvas focus-visible:bg-canvas'}`}
      >
        <span className={`flex items-center justify-center w-5 h-5 rounded shrink-0 transition-colors ${selected ? 'bg-brand-100/70 text-brand-700' : 'text-ink-400 group-hover:text-ink-600'}`}>
          <Icon size={14} />
        </span>
        <span className={`flex-1 min-w-0 truncate text-[0.8125rem] ${selected ? 'text-brand-900 font-semibold' : 'text-ink-700 font-medium'}`}>{file.name}</span>
        {file.status === 'processed'
          ? <span className={`shrink-0 text-[0.6875rem] tabular-nums ${selected ? 'text-brand-600' : 'text-ink-400'}`}>{signal}</span>
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

// ─── Reading pane: live preview header (right segment of the shared band) ────
// Option 2 — the selected file's identity (tile + name + status + download)
// renders on the SAME line as the rail's search, so one unbroken header band
// runs across the whole panel. This is just the inner content; the band itself
// owns the height/border.
function PreviewHeaderBar({ file }: { file: DatasetFile }) {
  const { addToast } = useToast();
  const { Icon } = fileTile(file);
  const isFailed = file.status === 'failed';
  const dateStr = new Date(file.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    /* Single-line file identity: a subtle brand tile anchors the icon, the name
       carries the weight, status follows, then a real hairline divider sets off
       the format/date meta. Download is a quiet ghost button at the end. */
    <div className="flex items-center gap-2.5 min-w-0 flex-1">
      <span className="w-7 h-7 rounded-md bg-brand-50 flex items-center justify-center shrink-0">
        <Icon size={15} className="text-brand-700" />
      </span>
      <span className="text-[0.9375rem] font-semibold tracking-tight text-ink-900 truncate min-w-0" title={file.name}>{file.name}</span>
      <StatusPillFlat status={file.status} />
      <span className="hidden md:block h-3.5 w-px bg-canvas-border shrink-0" aria-hidden />
      <span className="hidden md:inline-flex items-baseline gap-1.5 shrink-0 text-[0.75rem] tabular-nums">
        <span className="text-ink-500">{formatBytes(file.sizeBytes)}</span>
        <span className="text-ink-300">·</span>
        <span className="text-ink-400">uploaded {dateStr}</span>
      </span>
      {!isFailed && (
        <button
          onClick={() => { triggerDownload(file); addToast({ type: 'success', message: `Downloading ${file.name}…` }); }}
          className="ml-auto flex items-center justify-center w-8 h-8 rounded-md text-ink-400 hover:bg-canvas hover:text-brand-700 transition-colors cursor-pointer shrink-0"
          aria-label="Download"
          title="Download"
        >
          <Download size={16} />
        </button>
      )}
    </div>
  );
}

// ─── Reading pane: live preview body (right column, under the shared band) ───
function PreviewBody({ file }: { file: DatasetFile }) {
  if (file.status === 'failed') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6">
        <AlertCircle size={24} className="text-risk" />
        <p className="text-[0.8125rem] text-ink-700 font-medium">Processing failed</p>
        <p className="text-[0.75rem] text-ink-500">This file couldn’t be processed — the format may not be supported.</p>
      </div>
    );
  }
  /* Both PDF and sheet render BARE + edge-to-edge so they FILL the right pane
     (no nested card, no p-4 inset, no fixed-height viewer floating with a gap).
     The reading-pane region is itself the surface; FilePreviewBody picks the PDF
     viewer or the table internally — both honour `fill`. */
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <FilePreviewBody key={file.id} file={file} fill bare />
    </div>
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
      <li className="flex-1 min-h-0 flex flex-col">
        {isFailed ? (
          <>
            <div className="pb-3 text-[0.75rem] text-risk-700">Processing failed — the format may not be supported.</div>
            <FilePreviewBody file={file} tall />
          </>
        ) : (
          /* Fill the body so the preview behaves like the folder reading pane:
             a full-height frame whose grid scrolls internally (no clipped
             right edge on a wide table). */
          <FilePreviewBody file={file} fill />
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
            <div className="text-[0.75rem] text-risk-700 mt-0.5">Processing failed — the format may not be supported.</div>
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
              className="flex items-center justify-center w-8 h-8 text-ink-400 hover:text-brand-700 hover:bg-canvas rounded-md transition-opacity cursor-pointer opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
              aria-label={`Rename ${file.name}`}
              title="Rename"
            >
              <Pencil size={14} />
            </button>
          )}
          {!isFailed && (
            <button
              onClick={handleDownload}
              className="flex items-center justify-center w-8 h-8 text-ink-500 hover:text-brand-700 hover:bg-canvas rounded-md transition-colors cursor-pointer"
              aria-label={`Download ${file.name}`}
              title="Download"
            >
              <Download size={15} />
            </button>
          )}
          <button
            onClick={onToggle}
            className="flex items-center gap-1 px-2 py-1.5 text-[0.75rem] font-medium text-ink-500 hover:text-brand-700 hover:bg-canvas rounded-md transition-colors cursor-pointer"
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
      <div className="rounded-lg border border-canvas-border bg-canvas-elevated px-6 py-12 text-center">
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
              IRA can't read from this source. Retest the connection or contact IT.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<RotateCcw size={12} />}
                onClick={handleRetest}
              >
                Retest connection
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
    <div className="grid grid-cols-[180px_1fr_auto] items-center gap-3 px-5 py-2.5 hover:bg-canvas transition-colors">
      <div className="text-[0.75rem] font-medium text-ink-500">{field.label}</div>
      <div className={`text-[0.75rem] text-ink-900 ${field.sensitive && !revealed ? 'tracking-widest font-mono' : 'font-mono'} truncate`}>
        {display}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {field.sensitive && (
          <button
            onClick={() => setRevealed(p => !p)}
            className="p-1.5 text-ink-500 hover:text-brand-700 hover:bg-canvas rounded-md transition-colors cursor-pointer"
            aria-label={revealed ? 'Hide value' : 'Reveal value'}
          >
            {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        )}
        <button
          onClick={onCopy}
          className="p-1.5 text-ink-500 hover:text-brand-700 hover:bg-canvas rounded-md transition-colors cursor-pointer"
          aria-label={`Copy ${field.label}`}
        >
          <Copy size={13} />
        </button>
      </div>
    </div>
  );
}
