import { useEffect, useMemo, useRef, useState } from 'react';
// Default name for the kh-add combine input. Date-based so it sorts cleanly
// in the grid; user can edit or clear.
function defaultGroupName(): string {
  const d = new Date();
  return `Upload · ${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`;
}
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Search, Layers, FileText, Database, Upload, Check, Mail, Plus, Loader2, Folder,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import {
  SEED, INTEGRATED_TYPES, TYPE_META, formatDate,
  type DataSource,
} from '../data-sources/sources';

// ─── Selected attachment shape ───────────────────────────────────────────────
// Three flavours of selection:
//  - source:     a registered data source (file / DB / API / cloud / session)
//  - upload:     a fresh file the user just dropped in via the Upload tab.
//                `path` is the file's relative path (e.g. "Reports/Q1/sales.csv")
//                when it came from a folder; absent for loose files.
//  - connect-db: a fresh database connection from the kh-add Connect tab
export type AttachmentSelection =
  | { kind: 'source'; sourceId: string; name: string; subtype: string; type: DataSource['type'] }
  | { kind: 'upload'; localId: string; name: string; sizeBytes: number; path?: string }
  | { kind: 'connect-db'; dbType: string; name: string; database: string; host: string };

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (selections: AttachmentSelection[]) => void;
  // Optional overrides — let callers reuse the picker outside chat with a
  // different starting tab and verb. Defaults preserve the chat-attach UX.
  defaultTab?: TabId;
  title?: string;
  confirmLabel?: string;
  // 'chat'    — 4 tabs (Upload · All Data · Files · DB), with search.
  // 'kh-add'  — 2 tabs (Upload · Connect database), no search; the Connect
  //             tab renders the engine picker + credentials form.
  mode?: 'chat' | 'kh-add';
}

type TabId = 'all' | 'file' | 'integrated' | 'upload' | 'connect';

const CHAT_TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'upload',     label: 'Upload',   icon: Upload },
  { id: 'all',        label: 'All Data', icon: Layers },
  { id: 'file',       label: 'Files',    icon: FileText },
  { id: 'integrated', label: 'DB',       icon: Database },
];

// kh-add mode surfaces two tabs: Upload (drop files/folders) and Connect
// database (configure a DB integration). The Connect flow is a demo mechanic
// today — a real backend would wire OAuth / credential storage / sync.
const KH_ADD_TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'upload',  label: 'Upload',            icon: Upload },
  { id: 'connect', label: 'Connect database',  icon: Database },
];

export default function DataPickerModal({
  open,
  onClose,
  onConfirm,
  defaultTab = 'upload',
  title = 'Add data',
  confirmLabel = 'Attach',
  mode = 'chat',
}: Props) {
  const { addToast } = useToast();
  const TABS = mode === 'kh-add' ? KH_ADD_TABS : CHAT_TABS;
  const [tab, setTab] = useState<TabId>(defaultTab);
  const [search, setSearch] = useState('');
  // Multi-select state — keyed by source id (for source rows) or local upload id.
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());
  const [pendingUploads, setPendingUploads] = useState<Array<{ localId: string; name: string; sizeBytes: number; progress: number; path?: string }>>([]);
  // Optional "combine" name (kh-add only). Visible in the pending list when
  // 2+ loose files (no folder) are queued. Filled → all loose files commit
  // as one source under this name. Empty → each loose file = its own source.
  // Folder uploads are unaffected and always commit per-folder.
  const [combinedName, setCombinedName] = useState('');

  // Reset transient state when the modal opens fresh. The starting tab is
  // caller-controlled (defaults to Upload, which is the chat default).
  useEffect(() => {
    if (open) {
      setTab(defaultTab);
      setSearch('');
      setSelectedSourceIds(new Set());
      setPendingUploads([]);
      setCombinedName('');
    }
  }, [open, defaultTab]);

  const tabCounts = useMemo<Record<TabId, number>>(() => ({
    all:        SEED.length,
    file:       SEED.filter(d => d.type === 'file').length,
    integrated: SEED.filter(d => INTEGRATED_TYPES.includes(d.type)).length,
    upload:     pendingUploads.length,
    connect:    0, // no count — connect tab is an action, not a list
  }), [pendingUploads.length]);

  const visibleSources = useMemo(() => {
    return SEED
      .filter(d => {
        if (tab === 'all') return true;
        if (tab === 'file') return d.type === 'file';
        if (tab === 'integrated') return INTEGRATED_TYPES.includes(d.type);
        return false; // upload tab handles its own list
      })
      .filter(d => !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.subtype.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [tab, search]);

  // Only fully-uploaded files count toward the Attach total — in-flight files
  // shouldn't be attachable until they finish.
  const readyUploads = pendingUploads.filter(u => u.progress >= 100);
  const totalSelected = selectedSourceIds.size + readyUploads.length;
  const inFlightCount = pendingUploads.length - readyUploads.length;

  // Loose pending uploads (no folder path). Used to decide whether to show
  // the "Combine into one source" name input — only meaningful for 2+ loose.
  const loosePendingCount = pendingUploads.filter(u => !u.path || u.path === u.name).length;

  // Auto-fill the combine name with a sensible default the first time 2+
  // loose files appear in this modal session. User can edit or clear; if
  // cleared, it stays cleared (we don't re-apply the default).
  const combineDefaultedRef = useRef(false);
  useEffect(() => {
    if (mode !== 'kh-add') return;
    if (loosePendingCount >= 2 && !combineDefaultedRef.current) {
      setCombinedName(prev => (prev === '' ? defaultGroupName() : prev));
      combineDefaultedRef.current = true;
    }
  }, [mode, loosePendingCount]);
  useEffect(() => {
    if (!open) combineDefaultedRef.current = false;
  }, [open]);

  const toggleSource = (id: string) => {
    setSelectedSourceIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    const sourceSelections: AttachmentSelection[] = SEED
      .filter(s => selectedSourceIds.has(s.id))
      .map(s => ({ kind: 'source' as const, sourceId: s.id, name: s.name, subtype: s.subtype, type: s.type }));

    // Combine loose files into a single named source if the user typed a name.
    // Implementation trick: rewrite each loose file's path to `${combinedName}/${file.name}`
    // — DataSourcesView's existing folder-grouping logic will then treat them
    // as one source. Folders are unaffected.
    const combine = mode === 'kh-add' && combinedName.trim().length > 0;
    const combinedRoot = combinedName.trim();

    const uploadSelections: AttachmentSelection[] = readyUploads.map(u => {
      const isLoose = !u.path || u.path === u.name;
      const path = combine && isLoose ? `${combinedRoot}/${u.name}` : u.path;
      return { kind: 'upload' as const, localId: u.localId, name: u.name, sizeBytes: u.sizeBytes, path };
    });

    onConfirm([...sourceSelections, ...uploadSelections]);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="dpicker-title">
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-text/30 backdrop-blur-[3px]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            className={`relative w-[820px] max-w-[94vw] max-h-[88vh] bg-white rounded-2xl shadow-2xl border border-border-light flex flex-col overflow-hidden ${
              mode === 'kh-add' ? 'h-[680px]' : 'h-[600px]'
            }`}
          >
            {/* Header — title + (search) + close. Search is suppressed in kh-add mode. */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-paper-200">
              <h2 id="dpicker-title" className="text-[0.9375rem] font-semibold text-ink-800 shrink-0">{title}</h2>
              {mode === 'chat' && (
                <div className="relative flex-1 max-w-md ml-2">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    type="text"
                    placeholder={tab === 'upload' ? 'Drop files below to upload…' : 'Search sources…'}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    disabled={tab === 'upload'}
                    className="w-full pl-9 pr-3 h-9 rounded-md border border-border-light bg-white text-[0.8125rem] text-text placeholder:text-text-muted/60 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:bg-paper-50 disabled:text-text-muted transition-colors"
                  />
                </div>
              )}
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={onClose}
                  className="p-1.5 text-ink-500 hover:text-ink-800 rounded-md hover:bg-paper-50 transition-colors cursor-pointer"
                  aria-label="Close picker"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Tabs row */}
            <div className="flex items-center gap-0 px-5 border-b border-paper-200">
              {TABS.map(t => {
                const Icon = t.icon;
                const isActive = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`relative flex items-center gap-1.5 px-3.5 h-10 text-[0.75rem] font-medium transition-colors cursor-pointer ${
                      isActive ? 'text-primary' : 'text-text-muted hover:text-text'
                    }`}
                  >
                    <Icon size={13} />
                    {t.label}
                    {t.id !== 'upload' && t.id !== 'connect' && (
                      <span className={`tabular-nums text-[0.6875rem] ${isActive ? 'text-primary' : 'text-text-muted/60'}`}>
                        {tabCounts[t.id]}
                      </span>
                    )}
                    {isActive && (
                      <motion.div
                        layoutId="dpicker-tab-bar"
                        className="absolute left-0 right-0 -bottom-px h-[2px] bg-primary"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Body — tab-aware. The Connect tab renders its own panel + footer. */}
            {tab === 'connect' ? (
              <ConnectDbPanel
                onCancel={onClose}
                onConnect={(sel) => onConfirm([sel])}
              />
            ) : (
            <>
            <div className="flex-1 overflow-y-auto">
              {tab === 'upload' ? (
                <UploadPanel
                  pendingUploads={pendingUploads}
                  setPendingUploads={setPendingUploads}
                  mode={mode}
                />
              ) : (
                <SourceList
                  sources={visibleSources}
                  selectedIds={selectedSourceIds}
                  onToggle={toggleSource}
                  search={search}
                  showRequestIntegration={tab === 'integrated'}
                  onRequestIntegration={() => addToast({ type: 'info', message: 'Opening request form…' })}
                />
              )}
            </div>

            {/* Footer — selection count + Attach CTA. In kh-add upload tab,
                if 2+ loose files are queued, replace the status text with a
                slim "Group as" input on the left side. */}
            <div className="border-t border-border-light px-5 py-3 flex items-center justify-between gap-3 bg-surface-2/60">
              {mode === 'kh-add' && tab === 'upload' && loosePendingCount >= 2 ? (
                <label className="flex items-center gap-2 flex-1 min-w-0 max-w-md">
                  <span className="text-[0.75rem] font-medium text-text-secondary shrink-0">Group as</span>
                  <input
                    value={combinedName}
                    onChange={(e) => setCombinedName(e.target.value)}
                    placeholder="Leave empty to add as separate files"
                    className="flex-1 min-w-0 h-8 px-2.5 rounded-md border border-border-light bg-white text-[0.75rem] text-ink-900 placeholder:text-text-muted/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors"
                  />
                </label>
              ) : (
                <div className="text-[0.75rem] text-text-muted tabular-nums flex items-center gap-2">
                  {totalSelected === 0 && inFlightCount === 0 && (
                    <>Pick sources or files to attach to your message.</>
                  )}
                  {totalSelected > 0 && (
                    <span><span className="font-semibold text-text-secondary">{totalSelected}</span> {totalSelected === 1 ? 'item' : 'items'} selected</span>
                  )}
                  {inFlightCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-primary">
                      <Loader2 size={11} className="animate-spin" />
                      {inFlightCount} uploading…
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-3 h-9 rounded-md text-[0.75rem] font-medium text-text-muted hover:text-text hover:bg-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={totalSelected === 0}
                  className="flex items-center gap-1.5 px-4 h-9 rounded-md bg-primary hover:bg-primary-hover active:bg-primary-hover disabled:bg-surface-2 disabled:text-text-muted disabled:cursor-not-allowed text-white text-[0.75rem] font-semibold transition-colors cursor-pointer"
                >
                  <Check size={13} />
                  {totalSelected > 0 ? `${confirmLabel} ${totalSelected}` : confirmLabel}
                </button>
              </div>
            </div>
            </>
            )}

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ─── Source list — used by All / Files / DB tabs ─────────────────────────────

interface SourceListProps {
  sources: DataSource[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  search: string;
  showRequestIntegration: boolean;
  onRequestIntegration: () => void;
}

function SourceList({ sources, selectedIds, onToggle, search, showRequestIntegration, onRequestIntegration }: SourceListProps) {
  if (sources.length === 0) {
    return (
      <div className="text-center py-16 px-6">
        <Search size={24} className="mx-auto text-text-muted/60 mb-3" />
        <p className="text-[0.8125rem] text-text-muted">
          {search ? `No sources match "${search}".` : 'No sources available.'}
        </p>
        {showRequestIntegration && !search && (
          <a
            href="mailto:support@irame.ai?subject=Database%20integration%20request"
            onClick={onRequestIntegration}
            className="inline-flex items-center gap-2 mt-4 px-3 h-9 rounded-md bg-primary hover:bg-primary-hover text-white text-[0.75rem] font-semibold transition-colors cursor-pointer"
          >
            <Plus size={13} />
            Request a DB integration
          </a>
        )}
      </div>
    );
  }

  return (
    <div>
      <ul className="divide-y divide-border-light">
        {sources.map(s => (
          <SourceRow
            key={s.id}
            source={s}
            selected={selectedIds.has(s.id)}
            onToggle={() => onToggle(s.id)}
          />
        ))}
      </ul>

      {showRequestIntegration && (
        <div className="px-5 py-4 border-t border-border-light bg-surface-2/60 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Mail size={13} className="text-text-muted shrink-0" />
            <span className="text-[0.75rem] text-text-muted truncate">
              Need another source? IT can wire it up.
            </span>
          </div>
          <a
            href="mailto:support@irame.ai?subject=Database%20integration%20request"
            onClick={onRequestIntegration}
            className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md border border-border-light bg-white text-[0.75rem] font-semibold text-text-secondary hover:border-primary-light transition-colors cursor-pointer shrink-0"
          >
            <Plus size={12} />
            Request a DB integration
          </a>
        </div>
      )}
    </div>
  );
}

function SourceRow({ source, selected, onToggle }: { source: DataSource; selected: boolean; onToggle: () => void }) {
  const { icon: Icon, tone, label: typeLabel } = TYPE_META[source.type];
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors cursor-pointer ${
          selected ? 'bg-primary-xlight' : 'hover:bg-surface-2'
        }`}
        aria-pressed={selected}
      >
        {/* Checkbox */}
        <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all ${
          selected ? 'bg-primary border-primary' : 'bg-white border-border-light'
        }`}>
          {selected && <Check size={11} className="text-white" />}
        </div>

        {/* Type-tinted icon tile */}
        <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${tone}`}>
          <Icon size={15} />
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className={`text-[0.8125rem] font-medium truncate ${selected ? 'text-primary' : 'text-text'}`}>
            {source.name}
          </div>
          <div className="text-[0.6875rem] text-text-muted mt-0.5 tabular-nums truncate">
            {source.subtype} <span className="text-text-muted/60">· {formatDate(source.createdAt)}</span>
          </div>
        </div>

        {/* Type label pill (subtle, right-aligned) */}
        <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[0.75rem] font-semibold text-text-muted bg-surface-2">
          {typeLabel}
        </span>
      </button>
    </li>
  );
}

// ─── Upload panel — drag/drop + native file picker ──────────────────────────

type PendingUpload = { localId: string; name: string; sizeBytes: number; progress: number; path?: string };

interface UploadPanelProps {
  pendingUploads: PendingUpload[];
  setPendingUploads: React.Dispatch<React.SetStateAction<PendingUpload[]>>;
  // Knowledge Hub restricts to data-source types; chat composer accepts anything
  // the user wants to attach to a message (preserving the original chat UX).
  mode: 'chat' | 'kh-add';
}

const KH_ALLOWED_EXTS = ['.pdf', '.csv', '.xlsx', '.doc', '.docx'];
function isAllowedForMode(name: string, mode: 'chat' | 'kh-add'): boolean {
  if (mode === 'chat') return true;
  const lower = name.toLowerCase();
  return KH_ALLOWED_EXTS.some(ext => lower.endsWith(ext));
}

// Walk a DataTransferItemList recursively. webkitGetAsEntry is supported in
// Chrome/Edge/Safari/Firefox; the entry API gives us folder traversal.
type Entry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (cb: (f: File) => void, err?: () => void) => void;
  createReader?: () => { readEntries: (cb: (entries: Entry[]) => void, err?: () => void) => void };
};

async function walkItems(items: DataTransferItemList, mode: 'chat' | 'kh-add'): Promise<Array<{ file: File; path: string }>> {
  const out: Array<{ file: File; path: string }> = [];
  const walks: Promise<void>[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // webkitGetAsEntry isn't on the standard typings.
    const entry = (item as DataTransferItem & { webkitGetAsEntry?: () => Entry | null }).webkitGetAsEntry?.();
    if (entry) {
      walks.push(walkEntry(entry, '', out, mode));
    } else {
      const f = item.getAsFile();
      if (f && isAllowedForMode(f.name, mode)) out.push({ file: f, path: f.name });
    }
  }
  await Promise.all(walks);
  return out;
}

function walkEntry(entry: Entry, prefix: string, out: Array<{ file: File; path: string }>, mode: 'chat' | 'kh-add'): Promise<void> {
  if (entry.isFile && entry.file) {
    return new Promise<void>(resolve => {
      entry.file!(
        f => {
          if (isAllowedForMode(f.name, mode)) out.push({ file: f, path: prefix ? `${prefix}/${f.name}` : f.name });
          resolve();
        },
        () => resolve(),
      );
    });
  }
  if (entry.isDirectory && entry.createReader) {
    const reader = entry.createReader();
    const newPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
    return new Promise<void>(resolve => {
      const readBatch = () => {
        reader.readEntries(
          async entries => {
            if (entries.length === 0) return resolve();
            await Promise.all(entries.map(e => walkEntry(e, newPrefix, out, mode)));
            readBatch(); // readEntries returns batches; keep reading until empty
          },
          () => resolve(),
        );
      };
      readBatch();
    });
  }
  return Promise.resolve();
}

function UploadPanel({ pendingUploads, setPendingUploads, mode }: UploadPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Add a batch of {file, path} to pending list and start progress simulators.
  const addFiles = (batch: Array<{ file: File; path: string }>) => {
    if (batch.length === 0) return;
    const ts = Date.now();
    const incoming: PendingUpload[] = batch.map((b, i) => ({
      localId: `up-${ts}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      name: b.file.name,
      sizeBytes: b.file.size,
      progress: 0,
      path: b.path !== b.file.name ? b.path : undefined,
    }));

    setPendingUploads(prev => [...incoming, ...prev]);
    incoming.forEach(uf => {
      const step = 5 + Math.round(Math.random() * 7); // ~1.5s total
      const t = setInterval(() => {
        setPendingUploads(prev => {
          const next = prev.map(p => p.localId === uf.localId
            ? { ...p, progress: Math.min(100, p.progress + step) }
            : p);
          const updated = next.find(p => p.localId === uf.localId);
          if (updated && updated.progress >= 100) clearInterval(t);
          return next;
        });
      }, 100);
    });
  };

  // File-input handler — flat list of files, no folder structure.
  const handleFileInput = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const batch = Array.from(fileList)
      .filter(f => isAllowedForMode(f.name, mode))
      .map(f => ({ file: f, path: f.name }));
    addFiles(batch);
  };

  // Folder-input handler — files have webkitRelativePath set to "Folder/sub/file.ext".
  const handleFolderInput = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const batch = Array.from(fileList)
      .filter(f => isAllowedForMode(f.name, mode))
      .map(f => {
        const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
        return { file: f, path: rel || f.name };
      });
    addFiles(batch);
  };

  // Drop handler — uses entry walker so dropped folders work.
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const batch = await walkItems(e.dataTransfer.items, mode);
      addFiles(batch);
    } else if (e.dataTransfer.files) {
      handleFileInput(e.dataTransfer.files);
    }
  };

  const removeUpload = (id: string) => {
    setPendingUploads(prev => prev.filter(u => u.localId !== id));
  };

  return (
    <div className="p-6 space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed text-center px-6 py-12 transition-colors ${
          isDragging ? 'border-primary bg-primary-xlight' : 'border-border-light bg-surface-2/60'
        }`}
      >
        <Upload size={28} className={`mx-auto mb-3 ${isDragging ? 'text-primary' : 'text-text-muted/60'}`} />
        <p className="text-[0.875rem] text-text-secondary font-medium">Drop files or a folder here</p>
        <p className="text-[0.75rem] text-text-muted mt-1">or pick from your computer</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          {...(mode === 'kh-add' ? { accept: '.pdf,.csv,.xlsx,.doc,.docx' } : {})}
          className="hidden"
          onChange={(e) => { handleFileInput(e.target.files); e.target.value = ''; }}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
          className="hidden"
          onChange={(e) => { handleFolderInput(e.target.files); e.target.value = ''; }}
        />
        <div className="inline-flex items-center gap-2 mt-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-primary hover:bg-primary-hover active:bg-primary-hover text-white text-[0.75rem] font-semibold transition-colors cursor-pointer"
          >
            <Upload size={13} />
            Choose files
          </button>
          <button
            onClick={() => folderInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3 h-9 rounded-md border border-paper-200 bg-paper-0 text-ink-800 hover:border-paper-300 hover:bg-paper-50 text-[0.75rem] font-semibold transition-colors cursor-pointer"
          >
            <Folder size={13} />
            Choose folder
          </button>
        </div>
        {mode === 'kh-add' && (
          <p className="text-[0.6875rem] text-ink-400 mt-3">PDF · CSV · XLSX</p>
        )}
      </div>

      {/* Pending uploads list — flat across modes. Folder uploads keep their
          path tag inline. The Combine input above only renders in kh-add when
          2+ loose files are queued. */}
      {pendingUploads.length > 0 && (
        <div className="rounded-xl border border-border-light bg-white overflow-hidden">
          <div className="px-4 py-2 border-b border-border-light bg-surface-2/60 flex items-center justify-between">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-text-muted">
              Uploads · {pendingUploads.length}
            </span>
            {pendingUploads.some(u => u.progress < 100) && (
              <span className="inline-flex items-center gap-1 text-[0.75rem] font-semibold text-primary">
                <Loader2 size={10} className="animate-spin" />
                Uploading {pendingUploads.filter(u => u.progress < 100).length}…
              </span>
            )}
          </div>

          <ul className="divide-y divide-border-light">
            {pendingUploads.map(u => (
              <PendingFileRow key={u.localId} upload={u} onRemove={removeUpload} indent={false} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const KB = 1024;
const MB = KB * 1024;
function formatBytesShort(bytes: number): string {
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

// ─── Connect DB panel ────────────────────────────────────────────────────────
// Engine grid + credentials form on a single page. Renders inside the picker's
// body slot when tab === 'connect'. Owns its own footer (Cancel / Connect) so
// the chat picker's selection footer doesn't apply here.

type DbType = { id: string; label: string; defaultPort: string };

const DB_TYPES: DbType[] = [
  { id: 'postgres',  label: 'PostgreSQL', defaultPort: '5432' },
  { id: 'mysql',     label: 'MySQL',      defaultPort: '3306' },
  { id: 'snowflake', label: 'Snowflake',  defaultPort: '443'  },
  { id: 'oracle',    label: 'Oracle',     defaultPort: '1521' },
  { id: 'mssql',     label: 'SQL Server', defaultPort: '1433' },
  { id: 'bigquery',  label: 'BigQuery',   defaultPort: '443'  },
];

interface ConnectDbPanelProps {
  onCancel: () => void;
  onConnect: (sel: Extract<AttachmentSelection, { kind: 'connect-db' }>) => void;
}

function ConnectDbPanel({ onCancel, onConnect }: ConnectDbPanelProps) {
  const [dbType, setDbType] = useState<DbType | null>(null);
  const [name, setName]         = useState('');
  const [host, setHost]         = useState('');
  const [port, setPort]         = useState('');
  const [database, setDatabase] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [connecting, setConnecting] = useState(false);

  const requiredFilled = !!dbType && name.trim() && host.trim() && database.trim() && username.trim() && password.trim();
  const canConnect = !!requiredFilled && testStatus === 'ok' && !connecting;

  const pickType = (t: DbType) => {
    if (dbType?.id === t.id) return;
    setDbType(t);
    setPort(t.defaultPort);
    setName(prev => prev.trim() || `${t.label} connection`);
    setTestStatus('idle');
  };

  const armTest = () => { if (testStatus !== 'idle') setTestStatus('idle'); };

  const runTest = () => {
    if (!requiredFilled) return;
    setTestStatus('testing');
    setTimeout(() => setTestStatus('ok'), 1200);
  };

  const submit = () => {
    if (!dbType || !canConnect) return;
    setConnecting(true);
    setTimeout(() => {
      onConnect({
        kind: 'connect-db',
        dbType: dbType.label,
        name: name.trim(),
        database: database.trim(),
        host: host.trim(),
      });
      setConnecting(false);
    }, 600);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 px-6 py-4 space-y-4">
        {/* Engine grid — selected uses brand-50 bg + brand-600 border per DESIGN.md selected state. */}
        <section>
          <div className="text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-ink-500 mb-2">Engine</div>
          <div className="grid grid-cols-3 gap-2">
            {DB_TYPES.map(t => {
              const selected = dbType?.id === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pickType(t)}
                  aria-pressed={selected}
                  className={`flex items-center gap-2.5 px-3 h-10 rounded-lg border text-left transition-colors cursor-pointer ${
                    selected
                      ? 'border-brand-600 bg-brand-50'
                      : 'border-paper-200 bg-paper-0 hover:border-paper-300 hover:bg-paper-50'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                    selected ? 'bg-brand-600 text-white' : 'bg-evidence-50 text-evidence-700'
                  }`}>
                    <Database size={12} />
                  </div>
                  <div className={`text-[0.75rem] font-semibold truncate ${selected ? 'text-brand-700' : 'text-ink-800'}`}>
                    {t.label}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Credentials — always editable; the test/connect buttons gate on engine pick. */}
        <section className="grid grid-cols-2 gap-x-3 gap-y-3">
          <Field label="Connection name" required full>
            <input value={name} onChange={(e) => { setName(e.target.value); armTest(); }} placeholder="Prod analytics" className={inputCls} />
          </Field>
          <Field label="Host" required>
            <input value={host} onChange={(e) => { setHost(e.target.value); armTest(); }} placeholder="db.example.com" className={inputCls} />
          </Field>
          <Field label="Port">
            <input value={port} onChange={(e) => { setPort(e.target.value); armTest(); }} placeholder={dbType?.defaultPort ?? '—'} className={`${inputCls} tabular-nums`} />
          </Field>
          <Field label="Database" required full>
            <input value={database} onChange={(e) => { setDatabase(e.target.value); armTest(); }} placeholder="analytics_prod" className={inputCls} />
          </Field>
          <Field label="Username" required>
            <input value={username} onChange={(e) => { setUsername(e.target.value); armTest(); }} placeholder="ira_reader" autoComplete="off" className={inputCls} />
          </Field>
          <Field label="Password" required>
            <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); armTest(); }} placeholder="••••••••" autoComplete="new-password" className={inputCls} />
          </Field>
        </section>

        {/* Test row — secondary button + flat status pill (DESIGN.md §6 Pill: no border, no icon). */}
        <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={runTest}
              disabled={!requiredFilled || testStatus === 'testing'}
              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md border border-paper-200 bg-paper-0 text-[0.75rem] font-semibold text-ink-800 hover:border-paper-300 hover:bg-paper-50 disabled:bg-paper-100 disabled:text-ink-400 disabled:border-paper-200 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {testStatus === 'testing' && <Loader2 size={12} className="animate-spin" />}
              {testStatus === 'testing' ? 'Testing…' : 'Test connection'}
            </button>
            {testStatus === 'ok' && (
              <span className="inline-flex items-center h-6 px-2 rounded-full text-[0.75rem] font-semibold bg-compliant-50 text-compliant-700">
                Connection successful
              </span>
            )}
            {testStatus === 'fail' && (
              <span className="inline-flex items-center h-6 px-2 rounded-full text-[0.75rem] font-semibold bg-risk-50 text-risk-700">
                Could not connect
              </span>
            )}
            {testStatus === 'idle' && (
              <span className="text-[0.75rem] text-ink-500">
                {requiredFilled ? 'Test before connecting.' : !dbType ? 'Pick an engine to begin.' : 'Fill the required fields.'}
              </span>
            )}
        </div>
      </div>

      {/* Footer — paper-50 strip, helper on left, action group on right. */}
      <div className="border-t border-paper-200 px-6 py-3 flex items-center justify-between bg-paper-50">
        <span className="text-[0.75rem] text-ink-500">Credentials are stored encrypted.</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 h-9 rounded-md border border-paper-200 bg-paper-0 text-[0.75rem] font-semibold text-ink-800 hover:border-paper-300 hover:bg-paper-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canConnect}
            className="inline-flex items-center gap-1.5 px-4 h-9 rounded-md bg-brand-600 hover:bg-brand-500 active:bg-brand-800 text-white text-[0.75rem] font-semibold disabled:bg-brand-600/40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {connecting && <Loader2 size={13} className="animate-spin" />}
            {connecting ? 'Connecting…' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  'w-full h-10 px-3 rounded-md border border-paper-200 bg-paper-0 text-[0.8125rem] text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 focus:ring-[3px] focus:ring-brand-600/20 disabled:bg-paper-100 disabled:text-ink-400 disabled:cursor-not-allowed transition-colors';

function Field({
  label, required, full, children,
}: { label: string; required?: boolean; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={`flex flex-col gap-1.5 ${full ? 'col-span-2' : ''}`}>
      <span className="text-[0.75rem] font-medium text-ink-700">
        {label}{required && <span className="text-risk ml-0.5" aria-hidden>*</span>}
      </span>
      {children}
    </label>
  );
}

// ─── Pending list rendering helpers ──────────────────────────────────────────

// Flat pending file row — shows the file's name plus a small path tag when
// the file came from a folder upload (e.g. "sales.pdf · Reports/Q1"). Used
// in both chat and kh-add modes.
function PendingFileRow({
  upload, onRemove, indent,
}: { upload: PendingUpload; onRemove: (id: string) => void; indent: boolean }) {
  const isDone = upload.progress >= 100;
  // Path tag = the directory portion of the path (everything except the
  // file name itself). Empty when file is loose.
  const pathTag = upload.path && upload.path !== upload.name
    ? upload.path.replace(`/${upload.name}`, '') || upload.path
    : '';
  return (
    <li className={`flex items-center gap-3 py-3 ${indent ? 'pl-10 pr-4' : 'px-4'}`}>
      {pathTag ? (
        <Folder size={14} className={`shrink-0 ${isDone ? 'text-primary' : 'text-text-muted/60'}`} />
      ) : (
        <FileText size={14} className={`shrink-0 ${isDone ? 'text-primary' : 'text-text-muted/60'}`} />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-[0.8125rem] text-text truncate flex-1 min-w-0">
            {upload.name}
            {pathTag && (
              <span className="ml-1.5 text-[0.6875rem] text-ink-400 font-normal" title={upload.path}>
                · {pathTag}
              </span>
            )}
          </div>
          {isDone ? (
            <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[0.75rem] font-semibold text-compliant bg-compliant-50">
              <Check size={10} />
              Ready
            </span>
          ) : (
            <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[0.75rem] font-semibold text-primary bg-primary-xlight">
              <Loader2 size={10} className="animate-spin" />
              {upload.progress}%
            </span>
          )}
        </div>
        {!isDone && (
          <div className="mt-1.5 h-1.5 rounded-full bg-surface-2 overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${upload.progress}%` }}
              transition={{ duration: 0.18, ease: 'linear' }}
            />
          </div>
        )}
        <div className={`text-[0.6875rem] tabular-nums mt-${isDone ? '0.5' : '1'} text-text-muted`}>
          {formatBytesShort(upload.sizeBytes)}
        </div>
      </div>
      <button
        onClick={() => onRemove(upload.localId)}
        className="p-1.5 text-text-muted hover:text-risk hover:bg-surface-2 rounded-md transition-colors cursor-pointer shrink-0"
        aria-label={`${isDone ? 'Remove' : 'Cancel'} ${upload.name}`}
      >
        <X size={13} />
      </button>
    </li>
  );
}

