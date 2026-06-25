import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Search,
  Upload,
  Layers,
  FileText,
  FileSpreadsheet,
  FileJson,
  Database,
  Cloud,
  MessageSquare,
  Globe,
  Check,
  Plus,
  Star,
  Folder,
} from 'lucide-react';
import { DATA_SOURCES } from '../../data/mockData';
import type { JourneyFiles, UploadedFile, WorkflowDraft } from './types';
import Button from '../ui/Button';
import { cn } from '../../lib/cn';
import { useFavouriteSources } from '../data-sources/useFavouriteSources';

interface Props {
  open: boolean;
  onClose: () => void;
  /** When omitted (e.g. from the initial chat input), Attach simply reports
   *  the picks via onAttachDraft instead of mapping to workflow inputs. */
  workflow?: WorkflowDraft | null;
  files?: JourneyFiles;
  setFiles?: (f: JourneyFiles) => void;
  onLinkSource?: (sourceName: string, inputName: string) => void;
  onAttachDraft?: (payload: {
    files: UploadedFile[];
    linkedSources: string[];
  }) => void;
  /** Modal heading. Defaults to "Add data". */
  title?: string;
  /** Restrict the tab strip to these tabs (e.g. ['upload'] for a pure uploader).
   *  Omit to show the full chat/workflow tab set. */
  allowedTabs?: TabId[];
  /** Footer hint shown when nothing is selected yet. Overrides the default
   *  chat-composer copy for callers embedding the picker elsewhere (e.g. ATR). */
  footerHint?: ReactNode;
  /** Hide chat "Session file" assets from the data lists (e.g. ATR, where a
   *  prior chat session's CSV is never a valid audit input). */
  hideSessionFiles?: boolean;
}

type TabId = 'upload' | 'all' | 'files' | 'db' | 'favourites' | 'folder';
type AssetKind = 'file' | 'db' | 'cloud' | 'session' | 'api';

interface Asset {
  id: string;
  name: string;
  kind: AssetKind;
  subtype: string;
  meta: string;
}

// Mock catalog used to populate All Data / Files / DB tabs. Combines existing
// DATA_SOURCES with a few extra assets so the variety matches the design.
const EXTRA_ASSETS: Asset[] = [
  {
    id: 'as-1',
    name: 'AI_Fare Audit',
    kind: 'file',
    subtype: 'XLSX',
    meta: 'XLSX · 12.4 MB · Apr 23, 2026',
  },
  {
    id: 'as-2',
    name: 'PWC Status',
    kind: 'file',
    subtype: 'PDF',
    meta: 'PDF · 2.1 MB · Apr 23, 2026',
  },
  {
    id: 'as-3',
    name: 'S3 — auditify-evidence-bucket',
    kind: 'cloud',
    subtype: 'AWS S3',
    meta: 'AWS S3 · Apr 23, 2026',
  },
  {
    id: 'as-4',
    name: 'IRA chat — JE anomaly samples',
    kind: 'session',
    subtype: 'CSV',
    meta: 'CSV · linked to ch-005 · Apr 23, 2026',
  },
  {
    id: 'as-5',
    name: 'Workday Access Events',
    kind: 'api',
    subtype: 'REST',
    meta: 'REST · OAuth2 · Apr 21, 2026',
  },
  {
    id: 'as-6',
    name: 'Snowflake — finance.warehouse',
    kind: 'db',
    subtype: 'Snowflake',
    meta: 'Snowflake · 18.5M rows · Apr 22, 2026',
  },
  {
    id: 'as-7',
    name: 'BigQuery — gl_postings',
    kind: 'db',
    subtype: 'BigQuery',
    meta: 'BigQuery · 6.1M rows · Apr 18, 2026',
  },
];

function dataSourceToAsset(d: (typeof DATA_SOURCES)[number]): Asset {
  if (d.type === 'sql') {
    const engine = d.name.includes('SAP') ? 'Oracle' : 'PostgreSQL';
    return {
      id: d.id,
      name: d.name,
      kind: 'db',
      subtype: engine,
      meta: `${engine} · ${d.records} rows · ${d.lastSync}`,
    };
  }
  return {
    id: d.id,
    name: d.name,
    kind: 'file',
    subtype: d.type.toUpperCase(),
    meta: `${d.type.toUpperCase()} · ${d.records} records · ${d.lastSync}`,
  };
}

const ALL_ASSETS: Asset[] = [
  ...DATA_SOURCES.map(dataSourceToAsset),
  ...EXTRA_ASSETS,
];

// Sample folders so the Folder tab has content out of the box (mirrors the
// mock catalog behind All Data / Files). Real uploaded folders appear above these.
const MOCK_FOLDERS: { name: string; count: number; bytes: number }[] = [
  { name: 'FY26 Q1 — SOX Evidence', count: 8, bytes: 18_400_000 },
  { name: 'Procure-to-Pay Walkthroughs', count: 5, bytes: 9_100_000 },
  { name: 'ITGC Access Reviews', count: 12, bytes: 24_700_000 },
];

// File rows are colored by their format (PDF red, spreadsheet green, …) so the
// list is scannable at a glance; non-file kinds keep their canonical tile color.
function fileSubtype(a: Asset): string {
  return (a.subtype || '').toUpperCase();
}

function assetIcon(a: Asset) {
  if (a.kind === 'db') return Database;
  if (a.kind === 'cloud') return Cloud;
  if (a.kind === 'session') return MessageSquare;
  if (a.kind === 'api') return Globe;
  switch (fileSubtype(a)) {
    case 'CSV':
    case 'XLSX':
    case 'XLS':
      return FileSpreadsheet;
    case 'JSON':
      return FileJson;
    default:
      return FileText;
  }
}

// Canonical kind→token mapping from data-sources/sources.ts (TYPE_META). Keeps
// this modal's tile colors in sync with DataSourcesView and DataPickerModal;
// file rows branch further on format.
function assetStyles(a: Asset): { wrap: string; icon: string } {
  switch (a.kind) {
    case 'db':
      return { wrap: 'bg-evidence-50', icon: 'text-evidence-700' };
    case 'cloud':
      return { wrap: 'bg-compliant-50', icon: 'text-compliant-700' };
    case 'session':
      return { wrap: 'bg-paper-100', icon: 'text-ink-700' };
    case 'api':
      return { wrap: 'bg-mitigated-50', icon: 'text-mitigated-700' };
    case 'file':
    default:
      switch (fileSubtype(a)) {
        case 'PDF':
          return { wrap: 'bg-risk-50', icon: 'text-risk-700' };
        case 'CSV':
        case 'XLSX':
        case 'XLS':
          return { wrap: 'bg-compliant-50', icon: 'text-compliant-700' };
        case 'DOC':
        case 'DOCX':
          return { wrap: 'bg-evidence-50', icon: 'text-evidence-700' };
        case 'PPT':
        case 'PPTX':
          return { wrap: 'bg-mitigated-50', icon: 'text-mitigated-700' };
        default:
          return { wrap: 'bg-brand-50', icon: 'text-brand-700' };
      }
  }
}

function kindBadgeLabel(kind: AssetKind): string {
  switch (kind) {
    case 'db':
      return 'Database';
    case 'cloud':
      return 'Cloud';
    case 'session':
      return 'Session file';
    case 'api':
      return 'API';
    case 'file':
    default:
      return 'File';
  }
}

// Map an asset's subtype to a file extension so a picked existing source can be
// handed back as a real (synthetic) File that downstream uploaders accept.
const SUBTYPE_EXT: Record<string, string> = {
  PDF: 'pdf', CSV: 'csv', XLSX: 'xlsx', XLS: 'xls', DOCX: 'docx', DOC: 'doc', PPTX: 'pptx', PPT: 'ppt', JSON: 'json', TXT: 'txt',
};
function sourceFileName(name: string, subtype: string): string {
  if (/\.[a-z0-9]{2,5}$/i.test(name)) return name;              // already has an extension
  const ext = SUBTYPE_EXT[(subtype || '').toUpperCase()];
  return ext ? `${name}.${ext}` : name;
}

export default function UploadDataModal({
  open,
  onClose,
  workflow,
  files,
  setFiles,
  onLinkSource,
  onAttachDraft,
  title = 'Add data',
  allowedTabs,
  footerHint,
  hideSessionFiles,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const { favs, toggleFav } = useFavouriteSources();
  const [tab, setTab] = useState<TabId>(allowedTabs?.[0] ?? 'upload');
  // The catalog this instance shows — chat "Session file" assets are dropped
  // for callers that pass hideSessionFiles (e.g. the ATR upload journey).
  const assets = useMemo(
    () => (hideSessionFiles ? ALL_ASSETS.filter((a) => a.kind !== 'session') : ALL_ASSETS),
    [hideSessionFiles],
  );
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);

  // Reset transient modal state on close.
  useEffect(() => {
    if (open) return;
    setTab(allowedTabs?.[0] ?? 'upload');
    setSearch('');
    setSelectedIds(new Set());
    setPendingFiles([]);
    setDragOver(false);
  }, [open]);

  // Dismiss the modal on Escape — matches the wider app's keybinding
  // convention (Esc cancels overlays and clears in-flight intent).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const filesCount = useMemo(
    () => assets.filter((a) => a.kind === 'file' || a.kind === 'session').length,
    [assets],
  );
  const dbCount = useMemo(() => assets.filter((a) => a.kind === 'db').length, [assets]);
  const allCount = assets.length;
  const favCount = useMemo(() => assets.filter((a) => favs.has(a.id)).length, [assets, favs]);

  const visibleAssets = useMemo(() => {
    let list = assets;
    if (tab === 'files') list = list.filter((a) => a.kind === 'file' || a.kind === 'session');
    else if (tab === 'db') list = list.filter((a) => a.kind === 'db');
    else if (tab === 'favourites') list = list.filter((a) => favs.has(a.id));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) => a.name.toLowerCase().includes(q) || a.subtype.toLowerCase().includes(q),
      );
    }
    return list;
  }, [assets, tab, search, favs]);

  // Existing assets the user has ticked across the data tabs — shown alongside
  // fresh uploads in one combined list on the Upload tab.
  const selectedAssets = useMemo(
    () => assets.filter((a) => selectedIds.has(a.id)),
    [assets, selectedIds],
  );

  const toggleAsset = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePickFiles = (picked: FileList | null) => {
    if (!picked || picked.length === 0) return;
    const arr = Array.from(picked).map<UploadedFile>((f) => ({
      name: f.name,
      size: f.size,
      // webkitRelativePath is set for files picked via a folder ("Folder/file.csv");
      // empty for loose files. Drives the Folder tab grouping.
      path: f.webkitRelativePath || undefined,
      // Keep the real File blob so callers that actually parse the upload
      // (e.g. the ATR report extractor) can read it.
      file: f,
    }));
    setPendingFiles((prev) => [...prev, ...arr]);
  };

  const removePending = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // Folders among the current uploads, grouped by top-level path segment
  // ("Q1 SOX/file.csv" → "Q1 SOX"). Loose files (no "/") aren't folders.
  const uploadedFolders = useMemo(() => {
    const map = new Map<string, { name: string; files: UploadedFile[]; bytes: number }>();
    for (const f of pendingFiles) {
      if (!f.path || !f.path.includes('/')) continue;
      const top = f.path.split('/')[0];
      let e = map.get(top);
      if (!e) { e = { name: top, files: [], bytes: 0 }; map.set(top, e); }
      e.files.push(f);
      e.bytes += f.size;
    }
    return [...map.values()];
  }, [pendingFiles]);

  // Display list for the Folder tab: real uploaded folders first, then the
  // sample folders so the tab is never empty.
  const folderList = useMemo(() => [
    ...uploadedFolders.map((f) => ({ name: f.name, count: f.files.length, bytes: f.bytes, uploaded: true })),
    ...MOCK_FOLDERS.map((f) => ({ ...f, uploaded: false })),
  ], [uploadedFolders]);

  const removeFolder = (name: string) => {
    setPendingFiles((prev) => prev.filter((f) => !(f.path && f.path.includes('/') && f.path.split('/')[0] === name)));
  };

  const pickTargetInputId = (current: JourneyFiles): string => {
    if (!workflow) return '';
    const reqInputs = workflow.inputs.filter((i) => i.required);
    for (const inp of reqInputs) {
      if ((current[inp.id] ?? []).length === 0) return inp.id;
    }
    return workflow.inputs[0]?.id ?? '';
  };

  const totalSelected = pendingFiles.length + selectedIds.size;
  const canAttach = totalSelected > 0;

  const handleAttach = () => {
    if (!canAttach) return;

    const linkedSourceNames: string[] = [];
    for (const id of selectedIds) {
      const asset = ALL_ASSETS.find((a) => a.id === id);
      if (asset) linkedSourceNames.push(asset.name);
    }

    if (workflow && setFiles) {
      const next: JourneyFiles = { ...(files ?? {}) };

      // 1. Commit pending file uploads — auto-map to required inputs.
      for (const f of pendingFiles) {
        const target = pickTargetInputId(next);
        if (!target) continue;
        next[target] = [...(next[target] ?? []), f];
      }

      // 2. Link selected existing assets — record a linkedSource entry
      //    against the next available required input.
      for (const name of linkedSourceNames) {
        const target = pickTargetInputId(next);
        if (!target) continue;
        const linked: UploadedFile = {
          name,
          size: 0,
          linkedSource: true,
        };
        next[target] = [...(next[target] ?? []), linked];
        const inputName =
          workflow.inputs.find((i) => i.id === target)?.name ?? 'input';
        onLinkSource?.(name, inputName);
      }

      setFiles(next);
    } else {
      // No workflow — defer the picks to the caller. Selected EXISTING sources
      // are surfaced as files too (with a synthetic File blob + a real
      // extension) so callers that only read `files` receive them as well.
      const sourceFiles: UploadedFile[] = selectedAssets.map(a => {
        const filename = sourceFileName(a.name, a.subtype);
        return { name: filename, size: 0, linkedSource: true, file: new File([], filename) };
      });
      onAttachDraft?.({
        files: [...pendingFiles.slice(), ...sourceFiles],
        linkedSources: linkedSourceNames,
      });
    }
    onClose();
  };

  const ALL_TABS: { id: TabId; label: string; icon: typeof Upload; count?: number }[] = [
    { id: 'favourites', label: 'Favourites', icon: Star, count: favCount },
    { id: 'upload', label: 'Upload', icon: Upload },
    { id: 'all', label: 'All Data', icon: Layers, count: allCount },
    { id: 'files', label: 'Files', icon: FileText, count: filesCount },
    { id: 'folder', label: 'Folder', icon: Folder, count: folderList.length },
    { id: 'db', label: 'DB', icon: Database, count: dbCount },
  ];
  // Callers can restrict the tab set (e.g. ATR uses Upload only).
  const TABS = allowedTabs ? ALL_TABS.filter(t => allowedTabs.includes(t.id)) : ALL_TABS;

  // Portal to <body> so the overlay is fixed to the viewport (not trapped inside
  // a transformed ancestor, e.g. when opened over the ATR wizard modal) and its
  // scrim fully covers whatever is behind.
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[190] backdrop-blur-[6px]"
            style={{ background: 'rgba(15, 8, 30, 0.78)' }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-[840px] h-[680px] max-h-[86vh] rounded-xl bg-canvas-elevated border border-canvas-border shadow-[0_18px_48px_-18px_rgba(15,8,30,0.25)] flex flex-col overflow-hidden">
              {/* Header — title + close on their own row (search moved below the
                  tabs, matching the chat picker). */}
              <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-canvas-border">
                <h2 className="text-[15px] font-semibold text-ink-800 shrink-0">
                  {title}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-md text-ink-500 hover:bg-canvas flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Tabs — hidden entirely when there's a single tab (e.g. ATR's
                  upload-only picker). The row still appears for the "Choose
                  files/folder" edit buttons once something is picked. */}
              {(TABS.length > 1 || (tab === 'upload' && totalSelected > 0)) && (
              <div className="flex items-center gap-1 px-5 border-b border-canvas-border">
                {TABS.length > 1 && TABS.map((t) => {
                  const active = tab === t.id;
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={cn(
                        'relative inline-flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold transition-colors cursor-pointer',
                        active ? 'text-brand-700' : 'text-ink-500 hover:text-ink-800',
                      )}
                    >
                      <Icon size={14} />
                      {t.label}
                      {typeof t.count === 'number' && (
                        <span
                          className={cn(
                            'text-[12px] font-semibold tabular-nums',
                            active ? 'text-brand-600' : 'text-ink-400',
                          )}
                        >
                          {t.count}
                        </span>
                      )}
                      {active && (
                        <span className="absolute left-2 right-2 -bottom-px h-[2px] bg-brand-600 rounded-full" />
                      )}
                    </button>
                  );
                })}
                {/* Once something's picked the drop zone collapses to the list,
                    so the pickers move up here (mirrors the chat picker). */}
                {tab === 'upload' && totalSelected > 0 && (
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md bg-brand-600 hover:bg-brand-500 active:bg-brand-800 text-white text-[0.75rem] font-semibold transition-colors cursor-pointer"
                    >
                      <Upload size={13} />
                      Choose files
                    </button>
                    <button
                      type="button"
                      onClick={() => folderInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md border border-canvas-border bg-canvas-elevated text-ink-800 hover:border-brand-300 hover:bg-brand-50 text-[0.75rem] font-semibold transition-colors cursor-pointer"
                    >
                      <Folder size={13} />
                      Choose folder
                    </button>
                  </div>
                )}
              </div>
              )}

              {/* Search — sits directly below the tabs (it filters the active
                  tab's list). Data tabs only; Upload/Folder tabs have none. */}
              {tab !== 'upload' && tab !== 'folder' && (
                <div className="px-5 py-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                    <input
                      type="text"
                      placeholder="Search sources…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-9 pr-3 h-9 rounded-md border border-canvas-border bg-canvas-elevated text-[0.8125rem] text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Body */}
              <div className="flex-1 overflow-y-auto min-h-0 px-5 py-5 flex flex-col">
                {/* Always-mounted folder picker — triggered from the Folder tab
                    and the Upload tab's "Choose folder" button. webkitdirectory
                    set via ref (no typed prop). */}
                <input
                  ref={(el) => {
                    folderInputRef.current = el;
                    if (el && !el.hasAttribute('webkitdirectory')) el.setAttribute('webkitdirectory', '');
                  }}
                  type="file"
                  multiple
                  hidden
                  onChange={(e) => {
                    handlePickFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                {tab === 'upload' && (
                  <div
                    className="flex-1 flex flex-col min-h-0"
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      handlePickFiles(e.dataTransfer.files);
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      hidden
                      onChange={(e) => {
                        handlePickFiles(e.target.files);
                        e.target.value = '';
                      }}
                    />

                    {totalSelected === 0 ? (
                      // Standard "Add data" drop zone — plain target, no custom chrome.
                      <div
                        className={cn(
                          'w-full flex-1 min-h-[260px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center px-6 py-7 transition-colors',
                          dragOver ? 'border-brand-600 bg-brand-50' : 'border-canvas-border bg-canvas',
                        )}
                      >
                        <Upload size={24} className={cn('mb-2', dragOver ? 'text-brand-600' : 'text-ink-400')} aria-hidden="true" />
                        <p className="text-[0.875rem] font-medium text-ink-700">Drop files or a folder here</p>
                        <p className="text-[0.75rem] text-ink-500 mt-1">or pick from your computer</p>
                        <div className="inline-flex items-center gap-2 mt-3">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex items-center gap-2 px-4 h-10 rounded-md bg-brand-600 hover:bg-brand-500 active:bg-brand-800 text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer"
                          >
                            <Upload size={14} aria-hidden="true" /> Choose files
                          </button>
                          <button
                            type="button"
                            onClick={() => folderInputRef.current?.click()}
                            className="inline-flex items-center gap-2 px-4 h-10 rounded-md border border-canvas-border bg-canvas-elevated text-ink-800 hover:border-brand-300 hover:bg-brand-50 text-[0.8125rem] font-semibold transition-colors cursor-pointer"
                          >
                            <Folder size={14} aria-hidden="true" /> Choose folder
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Something picked — drop zone collapses to the combined
                      // list (pickers move to the tab row). Drag still works here.
                      <div className={cn(
                        'rounded-lg border bg-canvas-elevated overflow-hidden transition-colors',
                        dragOver ? 'border-brand-400 ring-2 ring-brand-200' : 'border-canvas-border',
                      )}>
                        <div className="px-3 py-2 border-b border-canvas-border bg-canvas">
                          <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-500">
                            Selected &amp; uploaded · {pendingFiles.length + selectedAssets.length}
                          </span>
                        </div>
                        <ul className="divide-y divide-canvas-border">
                          {/* Fresh uploads */}
                          {pendingFiles.map((f, i) => (
                            <li
                              key={`up-${f.name}-${i}`}
                              className="flex items-center gap-2 px-3 py-2"
                            >
                              <div className="w-7 h-7 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                                <FileText size={13} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-[13px] font-semibold text-ink-800 truncate">
                                  {f.name}
                                </div>
                                <div className="text-[12px] text-ink-400 tabular-nums">
                                  {f.size > 1024 * 1024
                                    ? `${(f.size / (1024 * 1024)).toFixed(1)} MB`
                                    : f.size > 1024
                                      ? `${(f.size / 1024).toFixed(1)} KB`
                                      : `${f.size} B`}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removePending(i)}
                                className="w-7 h-7 rounded-md text-ink-400 hover:text-risk hover:bg-canvas flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                aria-label={`Remove ${f.name}`}
                              >
                                <X size={13} />
                              </button>
                            </li>
                          ))}
                          {/* Existing sources ticked on the data tabs */}
                          {selectedAssets.map((a) => {
                            const Icon = assetIcon(a);
                            const styles = assetStyles(a);
                            return (
                              <li
                                key={`sel-${a.id}`}
                                className="flex items-center gap-2 px-3 py-2"
                              >
                                <div className={cn('w-7 h-7 rounded-md flex items-center justify-center shrink-0', styles.wrap)}>
                                  <Icon size={13} className={styles.icon} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-[13px] font-semibold text-ink-800 truncate">
                                    {a.name}
                                  </div>
                                  <div className="text-[12px] text-ink-400 tabular-nums truncate">
                                    {a.meta}
                                  </div>
                                </div>
                                <span className="text-[12px] text-ink-500 font-semibold rounded-md px-2 py-0.5 border border-canvas-border bg-canvas shrink-0">
                                  {kindBadgeLabel(a.kind)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => toggleAsset(a.id)}
                                  className="w-7 h-7 rounded-md text-ink-400 hover:text-risk hover:bg-canvas flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                  aria-label={`Remove ${a.name}`}
                                >
                                  <X size={13} />
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {(tab === 'all' || tab === 'files' || tab === 'db' || tab === 'favourites') && (
                  visibleAssets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-16">
                      <div className="text-[13px] font-semibold text-ink-700">
                        {search
                          ? `No matches for "${search}".`
                          : tab === 'favourites'
                            ? 'No favourites yet'
                            : 'No sources available'}
                      </div>
                      <div className="text-[12px] text-ink-400 mt-1">
                        {search
                          ? 'Try a different keyword.'
                          : tab === 'favourites'
                            ? 'Tap the ☆ on any source to add it here.'
                            : 'Connect a data source to see it listed here.'}
                      </div>
                    </div>
                  ) : (
                    <ul className="divide-y divide-canvas-border">
                      {visibleAssets.map((a) => {
                        const Icon = assetIcon(a);
                        const selected = selectedIds.has(a.id);
                        const fav = favs.has(a.id);
                        return (
                          <li
                            key={a.id}
                            className={cn(
                              'flex items-stretch transition-colors',
                              selected ? 'bg-brand-50' : 'hover:bg-canvas',
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => toggleAsset(a.id)}
                              aria-pressed={selected}
                              className="flex-1 min-w-0 flex items-center gap-3 pr-0 py-3 text-left cursor-pointer"
                            >
                              {/* Square checkbox — matches the chat picker + shared DS Checkbox. */}
                              <div className={cn(
                                'w-4 h-4 rounded-[5px] border flex items-center justify-center shrink-0 transition-colors',
                                selected ? 'bg-brand-600 border-brand-600' : 'bg-canvas-elevated border-canvas-border',
                              )}>
                                {selected && <Check size={11} className="text-white" strokeWidth={3} />}
                              </div>
                              {/* One calm lavender tile for every source; the glyph distinguishes type. */}
                              <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0 bg-brand-50 text-brand-700">
                                <Icon size={15} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className={cn('text-[13px] font-medium truncate', selected ? 'text-brand-700' : 'text-ink-800')}>
                                  {a.name}
                                </div>
                                <div className="text-[11.5px] text-ink-500 truncate mt-0.5 tabular-nums">
                                  {a.meta}
                                </div>
                              </div>
                              <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold text-ink-600 bg-paper-100">
                                {kindBadgeLabel(a.kind)}
                              </span>
                            </button>
                            {/* Favourite star — sibling so it doesn't toggle selection. */}
                            <button
                              type="button"
                              onClick={() => toggleFav(a.id)}
                              aria-label={fav ? `Remove ${a.name} from favourites` : `Add ${a.name} to favourites`}
                              aria-pressed={fav}
                              title={fav ? 'Favourited' : 'Add to favourites'}
                              className="shrink-0 px-4 flex items-center justify-center cursor-pointer text-ink-400 hover:text-amber-500 transition-colors"
                            >
                              <Star size={15} className={fav ? 'text-amber-500 fill-amber-500' : ''} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )
                )}

                {/* Folder tab — folders uploaded this session (0 until one is added). */}
                {tab === 'folder' && (
                  <ul className="divide-y divide-canvas-border">
                    {folderList.map((f) => (
                      <li
                        key={f.name}
                        className="group flex items-center gap-3 py-3 transition-colors hover:bg-canvas"
                      >
                        <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0 bg-brand-50 text-brand-700">
                          <Folder size={15} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium text-ink-800 truncate">{f.name}</div>
                          <div className="text-[11.5px] text-ink-500 truncate mt-0.5 tabular-nums">
                            {f.count} {f.count === 1 ? 'file' : 'files'} · {f.bytes > 1024 * 1024 ? `${(f.bytes / (1024 * 1024)).toFixed(1)} MB` : `${(f.bytes / 1024).toFixed(1)} KB`}
                          </div>
                        </div>
                        {f.uploaded && (
                          <button
                            type="button"
                            onClick={() => removeFolder(f.name)}
                            aria-label={`Remove folder ${f.name}`}
                            className="shrink-0 w-7 h-7 rounded-md text-ink-400 hover:text-risk hover:bg-canvas flex items-center justify-center transition-colors cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-canvas-border bg-canvas">
                <p className="text-[13px] text-ink-500 tabular-nums">
                  {totalSelected > 0 ? (
                    <><span className="font-semibold text-ink-700">{totalSelected}</span> {totalSelected === 1 ? 'item' : 'items'} selected</>
                  ) : (
                    footerHint ?? 'Pick sources or files to attach to your message.'
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="md" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    disabled={!canAttach}
                    onClick={handleAttach}
                    leadingIcon={<Plus size={13} />}
                  >
                    {totalSelected > 0 ? `Add ${totalSelected}` : 'Add'}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
