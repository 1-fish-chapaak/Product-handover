import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Search,
  UploadCloud,
  Upload,
  Layers,
  FileText,
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

function kindIcon(kind: AssetKind) {
  if (kind === 'db') return Database;
  if (kind === 'cloud') return Cloud;
  if (kind === 'session') return MessageSquare;
  if (kind === 'api') return Globe;
  return FileText;
}

// Canonical kind→token mapping from data-sources/sources.ts (TYPE_META). Keeps
// this modal's tile colors in sync with DataSourcesView and DataPickerModal.
function kindStyles(kind: AssetKind): { wrap: string; icon: string } {
  switch (kind) {
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
      return { wrap: 'bg-brand-50', icon: 'text-brand-700' };
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

export default function UploadDataModal({
  open,
  onClose,
  workflow,
  files,
  setFiles,
  onLinkSource,
  onAttachDraft,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const { favs, toggleFav } = useFavouriteSources();
  const [tab, setTab] = useState<TabId>('upload');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);

  // Reset transient modal state on close.
  useEffect(() => {
    if (open) return;
    setTab('upload');
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
    () => ALL_ASSETS.filter((a) => a.kind === 'file' || a.kind === 'session').length,
    [],
  );
  const dbCount = useMemo(() => ALL_ASSETS.filter((a) => a.kind === 'db').length, []);
  const allCount = ALL_ASSETS.length;
  const favCount = useMemo(() => ALL_ASSETS.filter((a) => favs.has(a.id)).length, [favs]);

  const visibleAssets = useMemo(() => {
    let list = ALL_ASSETS;
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
  }, [tab, search, favs]);

  // Existing assets the user has ticked across the data tabs — shown alongside
  // fresh uploads in one combined list on the Upload tab.
  const selectedAssets = useMemo(
    () => ALL_ASSETS.filter((a) => selectedIds.has(a.id)),
    [selectedIds],
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
      // No workflow yet — defer the picks back to the caller.
      onAttachDraft?.({
        files: pendingFiles.slice(),
        linkedSources: linkedSourceNames,
      });
    }
    onClose();
  };

  const TABS: { id: TabId; label: string; icon: typeof Upload; count?: number }[] = [
    { id: 'favourites', label: 'Favourites', icon: Star, count: favCount },
    { id: 'upload', label: 'Upload', icon: Upload },
    { id: 'all', label: 'All Data', icon: Layers, count: allCount },
    { id: 'files', label: 'Files', icon: FileText, count: filesCount },
    { id: 'folder', label: 'Folder', icon: Folder, count: uploadedFolders.length },
    { id: 'db', label: 'DB', icon: Database, count: dbCount },
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[190]"
            style={{ background: 'rgba(15, 8, 30, 0.5)' }}
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
                  Add data
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

              {/* Tabs */}
              <div className="flex items-center gap-1 px-5 border-b border-canvas-border">
                {TABS.map((t) => {
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
              <div className="flex-1 overflow-y-auto min-h-0 px-5 py-5">
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
                      // Nothing picked yet — full drop zone with both pickers.
                      <div
                        className={cn(
                          'rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center px-6 transition-colors',
                          'min-h-[320px]',
                          dragOver
                            ? 'border-brand-400 bg-brand-50/60'
                            : 'border-canvas-border bg-canvas',
                        )}
                      >
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 text-ink-400">
                          <UploadCloud size={32} strokeWidth={1.5} />
                        </div>
                        <div className="text-[15px] font-semibold text-ink-800">
                          Drop files here
                        </div>
                        <div className="text-[13px] text-ink-500 mt-1">
                          or pick from your computer
                        </div>
                        <div className="inline-flex items-center gap-2 mt-4">
                          <Button
                            variant="primary"
                            size="md"
                            onClick={() => fileInputRef.current?.click()}
                            leadingIcon={<UploadCloud size={13} />}
                          >
                            Choose files
                          </Button>
                          <Button
                            variant="ghost"
                            size="md"
                            onClick={() => folderInputRef.current?.click()}
                            leadingIcon={<Folder size={13} />}
                          >
                            Choose folder
                          </Button>
                        </div>
                        <div className="text-[12px] text-ink-400 mt-3 tabular-nums">
                          CSV · Excel · PDF · ≤ 50 MB each
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
                            const Icon = kindIcon(a.kind);
                            const styles = kindStyles(a.kind);
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
                    <ul className="flex flex-col">
                      {visibleAssets.map((a, i) => {
                        const Icon = kindIcon(a.kind);
                        const styles = kindStyles(a.kind);
                        const selected = selectedIds.has(a.id);
                        const fav = favs.has(a.id);
                        return (
                          <li
                            key={a.id}
                            className={cn(
                              'flex items-stretch transition-colors',
                              i === 0 ? '' : 'border-t border-canvas-border',
                              selected ? 'bg-brand-50/40' : 'hover:bg-canvas',
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => toggleAsset(a.id)}
                              aria-pressed={selected}
                              className="flex-1 min-w-0 flex items-center gap-3 px-2 py-2.5 text-left cursor-pointer"
                            >
                              {/* Square checkbox — matches the chat picker + shared DS Checkbox. */}
                              <div className={cn(
                                'w-4 h-4 rounded-[5px] border flex items-center justify-center shrink-0 transition-colors',
                                selected ? 'bg-brand-600 border-brand-600' : 'bg-canvas-elevated border-canvas-border',
                              )}>
                                {selected && <Check size={11} className="text-white" strokeWidth={3} />}
                              </div>
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${styles.wrap}`}
                              >
                                <Icon size={14} className={styles.icon} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-[13px] font-semibold text-ink-800 truncate">
                                  {a.name}
                                </div>
                                <div className="text-[12px] text-ink-400 truncate mt-0.5 tabular-nums">
                                  {a.meta}
                                </div>
                              </div>
                              <span className="text-[12px] text-ink-500 font-semibold rounded-md px-2 py-0.5 border border-canvas-border bg-canvas shrink-0">
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
                              className="shrink-0 px-3 flex items-center justify-center cursor-pointer text-ink-400 hover:text-amber-500 transition-colors"
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
                  uploadedFolders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-16">
                      <Folder size={24} className="text-ink-300 mb-3" />
                      <div className="text-[13px] font-semibold text-ink-700">No folders uploaded yet</div>
                      <div className="text-[12px] text-ink-400 mt-1">Upload a folder to see it here.</div>
                      <Button
                        variant="ghost"
                        size="md"
                        onClick={() => folderInputRef.current?.click()}
                        className="mt-4"
                        leadingIcon={<Folder size={13} />}
                      >
                        Choose folder
                      </Button>
                    </div>
                  ) : (
                    <ul className="flex flex-col">
                      {uploadedFolders.map((f, i) => (
                        <li
                          key={f.name}
                          className={cn(
                            'flex items-center gap-3 px-2 py-2.5 transition-colors hover:bg-canvas',
                            i === 0 ? '' : 'border-t border-canvas-border',
                          )}
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-brand-50 text-brand-700">
                            <Folder size={14} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-semibold text-ink-800 truncate">{f.name}</div>
                            <div className="text-[12px] text-ink-400 truncate mt-0.5 tabular-nums">
                              {f.files.length} {f.files.length === 1 ? 'file' : 'files'} · {f.bytes > 1024 * 1024 ? `${(f.bytes / (1024 * 1024)).toFixed(1)} MB` : `${(f.bytes / 1024).toFixed(1)} KB`}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFolder(f.name)}
                            aria-label={`Remove folder ${f.name}`}
                            className="shrink-0 w-7 h-7 rounded-md text-ink-400 hover:text-risk hover:bg-canvas flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <X size={13} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-canvas-border bg-canvas">
                <p className="text-[13px] text-ink-500 tabular-nums">
                  {totalSelected > 0 ? (
                    <><span className="font-semibold text-ink-700">{totalSelected}</span> {totalSelected === 1 ? 'item' : 'items'} selected</>
                  ) : (
                    'Pick sources or files to attach to your message.'
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
    </AnimatePresence>
  );
}
