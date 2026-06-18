import { useEffect, useMemo, useRef, useState } from 'react';
// Default name for the kh-add combine input. Date-based so it sorts cleanly
// in the grid; user can edit or clear.
function defaultGroupName(): string {
  const d = new Date();
  return `Upload · ${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`;
}
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  X, Search, Layers, FileText, Database, Upload, Check, Mail, Plus, Loader2, Folder,
  AlertTriangle, Lock, Star,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import ConfirmationModal from '../shared/ConfirmationModal';
import { validateUploadFile, isAllowedKnowledgeFile, KH_ALLOWED_LABEL, KH_ALLOWED_ACCEPT } from '../data-sources/datasetFiles';
import {
  SEED, INTEGRATED_TYPES, TYPE_META, formatDate,
  type DataSource,
} from '../data-sources/sources';
import { useDialogA11y } from './useModalA11y';
import { useFavouriteSources } from '../data-sources/useFavouriteSources';

// ─── Selected attachment shape ───────────────────────────────────────────────
// Three flavours of selection:
//  - source:     a registered data source (file / DB / API / cloud / session)
//  - upload:     a fresh file the user just dropped in via the Upload tab.
//                `path` is the file's relative path (e.g. "Reports/Q1/sales.csv")
//                when it came from a folder; absent for loose files.
//  - connect-db: a fresh database connection from the kh-add Connect tab
export type AttachmentSelection =
  | { kind: 'source'; sourceId: string; name: string; subtype: string; type: DataSource['type'] }
  | { kind: 'upload'; localId: string; name: string; sizeBytes: number; path?: string; file?: File }
  | { kind: 'connect-db'; dbType: string; name: string; database: string; host: string };

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (selections: AttachmentSelection[]) => void | Promise<void>;
  // Optional overrides — let callers reuse the picker outside chat with a
  // different starting tab and verb. Defaults preserve the chat-attach UX.
  defaultTab?: TabId;
  title?: string;
  confirmLabel?: string;
  // 'chat'    — 4 tabs (Upload · All Data · Files · DB), with search.
  // 'kh-add'  — 2 tabs (Upload · Connect database), no search; the Connect
  //             tab renders the engine picker + credentials form.
  mode?: 'chat' | 'kh-add';
  // Footer hint shown (in chat mode) when nothing is selected yet. Defaults to
  // the chat-composer copy; callers embedding the picker elsewhere (e.g. a
  // workflow executor) can override it to match their context.
  attachHint?: React.ReactNode;
  // When the picker is opened to EDIT an existing composer selection, seed it so
  // the already-attached items show as selected: each source id ticks its list
  // row, each file appears (ready) in the Upload tab. Confirm then REPLACES the
  // selection, so unchecking in the modal removes it from the composer too.
  initialSourceIds?: string[];
  initialFiles?: File[];
}

type TabId = 'all' | 'file' | 'integrated' | 'upload' | 'connect' | 'favourites' | 'folder';

const CHAT_TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'favourites', label: 'Favourites', icon: Star },
  { id: 'upload',     label: 'Upload',     icon: Upload },
  { id: 'all',        label: 'All Data',   icon: Layers },
  { id: 'file',       label: 'Files',      icon: FileText },
  { id: 'folder',     label: 'Folder',     icon: Folder },
  { id: 'integrated', label: 'DB',         icon: Database },
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
  confirmLabel = 'Add',
  mode = 'chat',
  attachHint,
  initialSourceIds,
  initialFiles,
}: Props) {
  const { addToast } = useToast();
  const { favs, toggleFav } = useFavouriteSources();
  const TABS = mode === 'kh-add' ? KH_ADD_TABS : CHAT_TABS;
  const [tab, setTab] = useState<TabId>(defaultTab);
  const [search, setSearch] = useState('');
  // Multi-select state — keyed by source id (for source rows) or local upload id.
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  // Optional "combine" name (kh-add only). Visible in the pending list when
  // 2+ loose files (no folder) are queued. Filled → all loose files commit
  // as one source under this name. Empty → each loose file = its own source.
  // Folder uploads are unaffected and always commit per-folder.
  const [combinedName, setCombinedName] = useState('');
  // Guards a close while uploads are still in flight — shows a confirm first.
  const [confirmClose, setConfirmClose] = useState(false);
  // Guards Attach while uploads are still in flight (in-flight files won't be
  // added) — shows a confirm first.
  const [confirmAttach, setConfirmAttach] = useState(false);
  // Confirm before removing an item (upload or selected source) from the combined
  // list on the Upload tab. Holds what's pending removal, or null.
  const [pendingRemoval, setPendingRemoval] = useState<{ kind: 'upload' | 'source'; id: string; name: string } | null>(null);
  // True while the confirm handler is running (building entries / persisting).
  // Drives the button's loading state so a large batch doesn't look frozen.
  const [submitting, setSubmitting] = useState(false);
  // The Choose files / Choose folder buttons live in the tab row, but the file
  // inputs live inside UploadPanel — it registers these triggers so the buttons work.
  const uploadTriggersRef = useRef<{ chooseFiles: () => void; chooseFolder: () => void } | null>(null);

  // Reset transient state when the modal opens. The starting tab is caller-
  // controlled (defaults to Upload). If the caller passed an existing selection
  // (initialSourceIds / initialFiles), seed it so the picker reflects what's
  // already attached: source ids tick their rows, files appear ready in Upload.
  useEffect(() => {
    if (open) {
      setTab(defaultTab);
      setSearch('');
      setSelectedSourceIds(new Set(initialSourceIds ?? []));
      setPendingUploads(
        (initialFiles ?? []).map((f, i) => ({
          localId: `seed-${i}-${f.name}`,
          name: f.name,
          sizeBytes: f.size,
          progress: 100,
          status: 'ready' as const,
          file: f,
          path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || undefined,
        })),
      );
      setCombinedName('');
      setConfirmClose(false);
      setConfirmAttach(false);
      setPendingRemoval(null);
      setSubmitting(false);
    }
    // initialSourceIds/initialFiles are read only at open time (intentionally not
    // deps) so a parent re-render while open doesn't wipe in-modal edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultTab]);

  // Folders among this session's uploads, grouped by top-level path segment
  // ("Q1 SOX/file.csv" → "Q1 SOX"). Loose files (no "/") aren't folders.
  // Drives the Folder tab + its count (0 until a folder is uploaded).
  const uploadedFolders = useMemo(() => {
    const map = new Map<string, { name: string; files: PendingUpload[]; bytes: number }>();
    for (const u of pendingUploads) {
      if (!u.path || !u.path.includes('/')) continue;
      const top = u.path.split('/')[0];
      let e = map.get(top);
      if (!e) { e = { name: top, files: [], bytes: 0 }; map.set(top, e); }
      e.files.push(u);
      e.bytes += u.sizeBytes;
    }
    return [...map.values()];
  }, [pendingUploads]);

  const removeFolder = (name: string) => {
    setPendingUploads(prev => prev.filter(u => !(u.path && u.path.includes('/') && u.path.split('/')[0] === name)));
  };

  const tabCounts = useMemo<Record<TabId, number>>(() => ({
    all:        SEED.length,
    file:       SEED.filter(d => d.type === 'file').length,
    integrated: SEED.filter(d => INTEGRATED_TYPES.includes(d.type)).length,
    upload:     pendingUploads.length,
    connect:    0, // no count — connect tab is an action, not a list
    favourites: SEED.filter(d => favs.has(d.id)).length,
    folder:     uploadedFolders.length,
  }), [pendingUploads.length, favs, uploadedFolders.length]);

  const visibleSources = useMemo(() => {
    return SEED
      .filter(d => {
        if (tab === 'all') return true;
        if (tab === 'favourites') return favs.has(d.id);
        if (tab === 'file') return d.type === 'file';
        if (tab === 'integrated') return INTEGRATED_TYPES.includes(d.type);
        return false; // upload / folder tabs handle their own lists
      })
      .filter(d => !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.subtype.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [tab, search, favs]);

  // All currently-selected existing sources (across every tab) — shown alongside
  // fresh uploads in the combined list on the Upload tab.
  const selectedSources = SEED.filter(s => selectedSourceIds.has(s.id));
  // Upload tab is in its default (empty) state when nothing has been picked yet.
  const uploadEmpty = pendingUploads.length === 0 && selectedSources.length === 0;

  // Only fully-validated, fully-uploaded files count toward the Attach total —
  // in-flight files aren't attachable yet, and errored files never are.
  const readyUploads = pendingUploads.filter(u => u.status === 'ready');
  // Seeded uploads (pre-attached, localId 'seed-…') are ALREADY saved on the
  // composer, so closing shouldn't warn about discarding them — only net-new
  // ready uploads count toward the unsaved-close guard.
  const newReadyUploads = readyUploads.filter(u => !u.localId.startsWith('seed-'));
  const totalSelected = selectedSourceIds.size + readyUploads.length;
  const inFlightCount = pendingUploads.filter(u => u.status === 'validating' || u.status === 'uploading').length;
  // Failed files block the confirm — the user must remove them first (a real
  // ingest can't proceed with a corrupt/locked file in the batch).
  const errorCount = pendingUploads.filter(u => u.status === 'error').length;

  // Closing with unsaved uploads — files still uploading OR ready-but-not-yet-
  // added — would silently discard them, so intercept every dismiss path
  // (backdrop, ✕, Cancel) and confirm first. Errored-only files have nothing to
  // lose, so they don't trigger the guard.
  const requestClose = () => {
    if (inFlightCount > 0 || newReadyUploads.length > 0) setConfirmClose(true);
    else onClose();
  };

  // Loose pending uploads (no folder path). Used to decide whether to show
  // the "Combine into one source" name input — only meaningful for 2+ loose.
  const loosePendingCount = pendingUploads.filter(u => (!u.path || u.path === u.name) && u.status !== 'error').length;

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

  const handleConfirm = async () => {
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
      return { kind: 'upload' as const, localId: u.localId, name: u.name, sizeBytes: u.sizeBytes, path, file: u.file };
    });

    // Show the loading state for the duration of the (possibly slow) commit —
    // building entries + persisting bytes can take a moment for a big batch, and
    // without feedback the button looks frozen. The modal unmounts on success,
    // so submitting only needs clearing if the handler rejects.
    setSubmitting(true);
    // Yield a frame so the spinner actually paints before the (synchronous-heavy)
    // commit runs — otherwise the work can finish before the browser repaints and
    // the loading state never shows.
    await new Promise(r => requestAnimationFrame(() => r(undefined)));
    try {
      await onConfirm([...sourceSelections, ...uploadSelections]);
    } catch {
      setSubmitting(false);
    }
  };

  // Attaching while files are still in flight would drop them silently (only
  // ready uploads are attached) — confirm first.
  const requestConfirm = () => {
    if (errorCount > 0) {
      addToast({ type: 'error', message: `Remove the ${errorCount} failed file${errorCount > 1 ? 's' : ''} to continue.` });
      return;
    }
    if (inFlightCount > 0) setConfirmAttach(true);
    else void handleConfirm();
  };

  // Accessibility: focus-trap + Escape-to-close + body scroll-lock, matching the
  // other chat modals (AddToDashboard/Report). Cmd/Ctrl+Enter triggers Attach.
  // Escape routes through requestClose so the in-flight-upload guard still fires —
  // but is suppressed while a nested confirm dialog is open (it owns Escape).
  const dialogRef = useDialogA11y(
    open,
    () => { if (!confirmClose && !confirmAttach && !pendingRemoval) requestClose(); },
    { onReturn: requestConfirm },
  );

  return (
    <AnimatePresence>
      {open && (
        <div className="kh-no-focus-ring fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]"
            onClick={requestClose}
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dpicker-title"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            className={`relative max-w-[94vw] max-h-[88vh] bg-white rounded-2xl shadow-2xl border border-border-light flex flex-col overflow-hidden ${
              mode === 'kh-add' ? 'w-[820px] h-[680px]' : 'w-[960px] h-[600px]'
            }`}
          >
            {/* Header — title + close on their own row. */}
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-paper-200">
              <h2 id="dpicker-title" className="text-[0.9375rem] font-semibold text-ink-800">{title}</h2>
              <button
                onClick={requestClose}
                className="p-1.5 text-ink-500 hover:text-ink-800 rounded-md hover:bg-brand-50 transition-colors cursor-pointer shrink-0"
                aria-label="Close picker"
              >
                <X size={16} />
              </button>
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
                    className={`relative flex items-center gap-1.5 px-3.5 h-10 shrink-0 whitespace-nowrap text-[0.75rem] font-medium transition-colors cursor-pointer ${
                      isActive ? 'text-primary' : 'text-ink-500 hover:text-ink-800'
                    }`}
                  >
                    <Icon size={13} />
                    {t.label}
                    {t.id !== 'upload' && t.id !== 'connect' && (
                      <span className={`tabular-nums text-[0.6875rem] ${isActive ? 'text-primary' : 'text-ink-400'}`}>
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
              {/* Upload actions on the tab row — only once something is picked. The
                  default (empty) state keeps its centered buttons in the drop zone. */}
              {tab === 'upload' && !uploadEmpty && (
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => uploadTriggersRef.current?.chooseFiles()}
                    className="inline-flex items-center gap-1.5 px-3 h-8 shrink-0 whitespace-nowrap rounded-md bg-brand-600 hover:bg-brand-500 active:bg-brand-800 text-white text-[0.75rem] font-semibold transition-colors cursor-pointer"
                  >
                    <Upload size={13} />
                    Choose files
                  </button>
                  <button
                    type="button"
                    onClick={() => uploadTriggersRef.current?.chooseFolder()}
                    className="inline-flex items-center gap-1.5 px-3 h-8 shrink-0 whitespace-nowrap rounded-md border border-paper-200 bg-white text-ink-800 hover:border-brand-300 hover:bg-brand-50 text-[0.75rem] font-semibold transition-colors cursor-pointer"
                  >
                    <Folder size={13} />
                    Choose folder
                  </button>
                </div>
              )}
            </div>

            {/* Search — sits directly below the tabs (it filters the active
                tab's list). Chat mode, data tabs only; the Upload tab has none. */}
            {mode === 'chat' && tab !== 'upload' && tab !== 'folder' && (
              <div className="px-5 py-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    type="text"
                    placeholder="Search sources…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 h-9 rounded-md border border-paper-200 bg-white text-[0.8125rem] text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Body — tab-aware. The Connect tab renders its own panel + footer. */}
            {tab === 'connect' ? (
              <ConnectDbPanel
                onCancel={requestClose}
                onConnect={(sel) => onConfirm([sel])}
              />
            ) : (
            <>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {tab === 'upload' ? (
                <UploadPanel
                  pendingUploads={pendingUploads}
                  setPendingUploads={setPendingUploads}
                  selectedSources={selectedSources}
                  onRequestRemove={(item) => setPendingRemoval(item)}
                  triggersRef={uploadTriggersRef}
                  mode={mode}
                />
              ) : tab === 'folder' ? (
                <FolderUploadsList
                  folders={uploadedFolders}
                  onRemoveFolder={removeFolder}
                  onGoToUpload={() => setTab('upload')}
                />
              ) : (
                <SourceList
                  sources={visibleSources}
                  selectedIds={selectedSourceIds}
                  onToggle={toggleSource}
                  search={search}
                  showRequestIntegration={tab === 'integrated'}
                  onRequestIntegration={() => addToast({ type: 'info', message: 'Opening request form…' })}
                  favs={favs}
                  onToggleFav={toggleFav}
                  emptyFavourites={tab === 'favourites'}
                />
              )}
            </div>

            {/* Footer — selection count + Attach CTA. In kh-add upload tab,
                if 2+ loose files are queued, replace the status text with a
                slim "Group as" input on the left side. */}
            <div className="shrink-0 border-t border-paper-200 px-5 py-3 flex items-center justify-between gap-3 bg-canvas">
              {errorCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-semibold text-risk min-w-0">
                  <AlertTriangle size={13} className="shrink-0" />
                  <span className="truncate">
                    Remove the {errorCount === 1 ? 'failed file' : `${errorCount} failed files`} to continue.
                  </span>
                </span>
              ) : mode === 'kh-add' && tab === 'upload' && loosePendingCount >= 2 ? (
                <label className="flex items-center gap-2 flex-1 min-w-0 max-w-md">
                  <span className="text-[0.75rem] font-medium text-ink-700 shrink-0">Group as</span>
                  <input
                    value={combinedName}
                    onChange={(e) => setCombinedName(e.target.value)}
                    placeholder="Leave empty to add as separate files"
                    className="flex-1 min-w-0 h-8 px-2.5 rounded-md border border-paper-200 bg-white text-[0.75rem] text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 transition-colors"
                  />
                </label>
              ) : (
                <div className="text-[0.75rem] text-ink-500 tabular-nums flex items-center gap-2">
                  {totalSelected === 0 && inFlightCount === 0 && (
                    mode === 'kh-add'
                      ? <>Drop files or connect a database to add to your Knowledge Hub.</>
                      : (attachHint ?? <>Pick sources or files to attach to your message.</>)
                  )}
                  {totalSelected > 0 && (
                    <span><span className="font-semibold text-ink-700">{totalSelected}</span> {totalSelected === 1 ? 'item' : 'items'} selected</span>
                  )}
                  {inFlightCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-brand-600">
                      <Loader2 size={11} className="animate-spin" />
                      {inFlightCount} uploading…
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={requestClose}
                  disabled={submitting}
                  className="px-3 h-9 rounded-md text-[0.75rem] font-medium text-ink-500 hover:text-ink-800 hover:bg-paper-0 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={requestConfirm}
                  disabled={totalSelected === 0 || submitting || errorCount > 0}
                  className="flex items-center gap-1.5 px-4 h-9 rounded-md bg-brand-600 hover:bg-brand-500 active:bg-brand-800 disabled:bg-paper-200 disabled:text-ink-400 disabled:cursor-not-allowed text-white text-[0.75rem] font-semibold transition-colors cursor-pointer"
                >
                  {submitting
                    ? <><Loader2 size={13} className="animate-spin" /> Adding…</>
                    : <><Plus size={13} /> {totalSelected > 0 ? `${confirmLabel} ${totalSelected}` : confirmLabel}</>}
                </button>
              </div>
            </div>
            </>
            )}

          </motion.div>

          {/* Confirm before discarding unsaved uploads — files still uploading
              OR ready-but-not-yet-added. Copy adapts to which applies. */}
          <ConfirmationModal
            open={confirmClose}
            title={inFlightCount > 0 ? 'Uploads still in progress' : 'Discard uploaded files?'}
            description={
              inFlightCount > 0
                ? <>{inFlightCount} file{inFlightCount === 1 ? ' is' : 's are'} still uploading.
                  {' '}Closing now will cancel {inFlightCount === 1 ? 'it' : 'them'}{newReadyUploads.length > 0 ? ` and discard ${newReadyUploads.length} ready file${newReadyUploads.length === 1 ? '' : 's'}` : ''}.</>
                : <>{newReadyUploads.length} file{newReadyUploads.length === 1 ? ' is' : 's are'} ready to add.
                  {' '}Closing now will discard {newReadyUploads.length === 1 ? 'it' : 'them'} — {newReadyUploads.length === 1 ? 'it won’t' : 'they won’t'} be added to your Knowledge Hub.</>
            }
            confirmLabel={inFlightCount > 0 ? 'Cancel uploads' : 'Discard'}
            cancelLabel={inFlightCount > 0 ? 'Keep uploading' : 'Keep files'}
            tone="destructive"
            onConfirm={() => { setConfirmClose(false); onClose(); }}
            onClose={() => setConfirmClose(false)}
          />

          {/* Confirm before attaching while uploads are still finishing. */}
          <ConfirmationModal
            open={confirmAttach}
            title="Uploads still in progress"
            description={
              <>{inFlightCount} file{inFlightCount === 1 ? ' is' : 's are'} still uploading and won{'’'}t be included.
              {' '}Continue without {inFlightCount === 1 ? 'it' : 'them'}?</>
            }
            confirmLabel="Continue"
            cancelLabel="Wait"
            tone="primary"
            onConfirm={() => { setConfirmAttach(false); handleConfirm(); }}
            onClose={() => setConfirmAttach(false)}
          />

          <ConfirmationModal
            open={!!pendingRemoval}
            title="Remove this item?"
            description={pendingRemoval ? <>“{pendingRemoval.name}” will be removed from your selection.</> : null}
            confirmLabel="Remove"
            cancelLabel="Keep"
            tone="destructive"
            onConfirm={() => {
              const pr = pendingRemoval;
              if (pr) {
                if (pr.kind === 'upload') setPendingUploads(prev => prev.filter(u => u.localId !== pr.id));
                else setSelectedSourceIds(prev => { const next = new Set(prev); next.delete(pr.id); return next; });
              }
              setPendingRemoval(null);
            }}
            onClose={() => setPendingRemoval(null)}
          />
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
  favs: Set<string>;
  onToggleFav: (id: string) => void;
  /** True on the Favourites tab — tailors the empty state copy. */
  emptyFavourites?: boolean;
}

function SourceList({ sources, selectedIds, onToggle, search, showRequestIntegration, onRequestIntegration, favs, onToggleFav, emptyFavourites }: SourceListProps) {
  if (sources.length === 0) {
    return (
      <div className="text-center py-16 px-6">
        {emptyFavourites && !search
          ? <Star size={24} className="mx-auto text-ink-400 mb-3" />
          : <Search size={24} className="mx-auto text-ink-400 mb-3" />}
        <p className="text-[0.8125rem] text-ink-500">
          {search
            ? `No sources match "${search}".`
            : emptyFavourites
              ? 'No favourites yet — tap the ☆ on any source to add it.'
              : 'No sources available.'}
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
            fav={favs.has(s.id)}
            onToggleFav={() => onToggleFav(s.id)}
          />
        ))}
      </ul>

      {showRequestIntegration && (
        <div className="px-5 py-4 border-t border-paper-200 bg-paper-50 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Mail size={13} className="text-ink-500 shrink-0" />
            <span className="text-[0.75rem] text-ink-500 truncate">
              Need another source? IT can wire it up.
            </span>
          </div>
          <a
            href="mailto:support@irame.ai?subject=Database%20integration%20request"
            onClick={onRequestIntegration}
            className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md border border-paper-200 bg-white text-[0.75rem] font-semibold text-ink-600 hover:border-brand-300 transition-colors cursor-pointer shrink-0"
          >
            <Plus size={12} />
            Request a DB integration
          </a>
        </div>
      )}
    </div>
  );
}

function SourceRow({ source, selected, onToggle, fav, onToggleFav }: { source: DataSource; selected: boolean; onToggle: () => void; fav: boolean; onToggleFav: () => void }) {
  // One calm brand tile tone for every source so the icon frame reads the same
  // here as it does in the Knowledge Hub; the glyph still distinguishes type.
  const { icon: Icon, label: typeLabel } = TYPE_META[source.type];
  // Row + star are siblings (not nested buttons) so both stay valid, focusable
  // controls; the hover/selected tint lives on the <li> so it spans the whole row.
  return (
    <li className={`flex items-stretch transition-colors ${selected ? 'bg-primary-xlight' : 'hover:bg-paper-50'}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex-1 min-w-0 flex items-center gap-3 pl-5 pr-0 py-3 text-left cursor-pointer"
        aria-pressed={selected}
      >
        {/* Checkbox — mirrors the shared DS Checkbox (src/components/shared/Checkbox.tsx)
            so multi-select looks identical to the rest of the app. Kept as a div, not
            the shared <button> component, because the whole row is itself a button. */}
        <div className={`w-4 h-4 rounded-[5px] border flex items-center justify-center shrink-0 transition-colors ${
          selected ? 'bg-brand-600 border-brand-600' : 'bg-canvas-elevated border-canvas-border'
        }`}>
          {selected && <Check size={11} className="text-white" strokeWidth={3} />}
        </div>

        {/* Brand icon tile — same flat lavender frame everywhere */}
        <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0 bg-brand-50 text-brand-700">
          <Icon size={15} />
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className={`text-[0.8125rem] font-medium truncate ${selected ? 'text-primary' : 'text-ink-800'}`}>
            {source.name}
          </div>
          <div className="text-[0.6875rem] text-ink-500 mt-0.5 tabular-nums truncate">
            {source.subtype} <span className="text-ink-400">· {formatDate(source.createdAt)}</span>
          </div>
        </div>

        {/* Type label pill (subtle, right-aligned) */}
        <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[0.75rem] font-semibold text-ink-600 bg-paper-100">
          {typeLabel}
        </span>
      </button>

      {/* Favourite star — sibling control so it doesn't toggle row selection. */}
      <button
        type="button"
        onClick={onToggleFav}
        aria-label={fav ? `Remove ${source.name} from favourites` : `Add ${source.name} to favourites`}
        aria-pressed={fav}
        title={fav ? 'Favourited' : 'Add to favourites'}
        className="shrink-0 px-4 flex items-center justify-center cursor-pointer text-ink-400 hover:text-amber-500 transition-colors"
      >
        <Star size={15} className={fav ? 'text-amber-500 fill-amber-500' : ''} />
      </button>
    </li>
  );
}

// ─── Folder tab — folders uploaded this session ─────────────────────────────
// Reflects folders the user has uploaded (via the Upload tab's folder drop);
// empty (count 0) until one is added. Each folder commits as one source on Add.
function FolderUploadsList({
  folders,
  onRemoveFolder,
  onGoToUpload,
}: {
  folders: { name: string; files: PendingUpload[]; bytes: number }[];
  onRemoveFolder: (name: string) => void;
  onGoToUpload: () => void;
}) {
  if (folders.length === 0) {
    return (
      <div className="text-center py-16 px-6">
        <Folder size={24} className="mx-auto text-ink-400 mb-3" />
        <p className="text-[0.8125rem] text-ink-500">No folders uploaded yet.</p>
        <button
          type="button"
          onClick={onGoToUpload}
          className="inline-flex items-center gap-2 mt-4 px-3 h-9 rounded-md bg-primary hover:bg-primary-hover text-white text-[0.75rem] font-semibold transition-colors cursor-pointer"
        >
          <Upload size={13} />
          Upload a folder
        </button>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border-light">
      {folders.map(f => (
        <li key={f.name} className="flex items-center gap-3 px-5 py-3 hover:bg-paper-50 transition-colors">
          <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0 bg-brand-50 text-brand-700">
            <Folder size={15} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[0.8125rem] font-medium text-ink-800 truncate">{f.name}</div>
            <div className="text-[0.6875rem] text-ink-500 mt-0.5 tabular-nums truncate">
              {f.files.length} {f.files.length === 1 ? 'file' : 'files'} · {formatBytesShort(f.bytes)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onRemoveFolder(f.name)}
            aria-label={`Remove folder ${f.name}`}
            title="Remove folder"
            className="shrink-0 p-1.5 rounded-md text-ink-400 hover:text-risk hover:bg-risk-50 transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </li>
      ))}
    </ul>
  );
}

// ─── Upload panel — drag/drop + native file picker ──────────────────────────

type UploadStatus = 'validating' | 'uploading' | 'ready' | 'error';
type PendingUpload = { localId: string; name: string; sizeBytes: number; progress: number; path?: string; file?: File; status: UploadStatus; error?: string };

interface UploadPanelProps {
  pendingUploads: PendingUpload[];
  setPendingUploads: React.Dispatch<React.SetStateAction<PendingUpload[]>>;
  // Existing sources the user has ticked on the data tabs — shown alongside fresh
  // uploads in one combined list so every pick sits in one place.
  selectedSources: DataSource[];
  // Ask the parent to confirm + remove an item (upload or source) from the list.
  onRequestRemove: (item: { kind: 'upload' | 'source'; id: string; name: string }) => void;
  // The tab-row Choose files / Choose folder buttons (rendered by the parent) call
  // into these — UploadPanel owns the file inputs, so it registers the triggers.
  triggersRef: React.MutableRefObject<{ chooseFiles: () => void; chooseFolder: () => void } | null>;
  // Knowledge Hub restricts to data-source types; chat composer accepts anything
  // the user wants to attach to a message (preserving the original chat UX).
  mode: 'chat' | 'kh-add';
}

function isAllowedForMode(name: string, mode: 'chat' | 'kh-add'): boolean {
  if (mode === 'chat') return true;
  return isAllowedKnowledgeFile(name);
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

// Accumulates files dropped that were filtered out by type, so the drop path
// can give the same "N skipped" feedback the file/folder pickers do.
type WalkAcc = { skipped: number };

async function walkItems(items: DataTransferItemList, mode: 'chat' | 'kh-add'): Promise<{ files: Array<{ file: File; path: string }>; skipped: number }> {
  const out: Array<{ file: File; path: string }> = [];
  const acc: WalkAcc = { skipped: 0 };
  const walks: Promise<void>[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // webkitGetAsEntry isn't on the standard typings.
    const entry = (item as DataTransferItem & { webkitGetAsEntry?: () => Entry | null }).webkitGetAsEntry?.();
    if (entry) {
      walks.push(walkEntry(entry, '', out, mode, acc));
    } else {
      const f = item.getAsFile();
      if (f) {
        if (isAllowedForMode(f.name, mode)) out.push({ file: f, path: f.name });
        else acc.skipped++;
      }
    }
  }
  await Promise.all(walks);
  return { files: out, skipped: acc.skipped };
}

function walkEntry(entry: Entry, prefix: string, out: Array<{ file: File; path: string }>, mode: 'chat' | 'kh-add', acc: WalkAcc): Promise<void> {
  if (entry.isFile && entry.file) {
    return new Promise<void>(resolve => {
      entry.file!(
        f => {
          if (isAllowedForMode(f.name, mode)) out.push({ file: f, path: prefix ? `${prefix}/${f.name}` : f.name });
          else acc.skipped++;
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
            await Promise.all(entries.map(e => walkEntry(e, newPrefix, out, mode, acc)));
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

function UploadPanel({ pendingUploads, setPendingUploads, selectedSources, onRequestRemove, triggersRef, mode }: UploadPanelProps) {
  const { addToast } = useToast();
  const prefersReducedMotion = useReducedMotion();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Track every progress-simulator interval so they can be stopped if the user
  // closes the modal (or switches away) mid-upload. Without this the timers
  // leak and keep calling setState after unmount.
  const intervalsRef = useRef<number[]>([]);
  useEffect(() => () => { intervalsRef.current.forEach(clearInterval); intervalsRef.current = []; }, []);

  // Expose the file/folder pickers to the parent so the tab-row buttons can
  // trigger them (the hidden inputs live here in UploadPanel).
  useEffect(() => {
    triggersRef.current = {
      chooseFiles: () => fileInputRef.current?.click(),
      chooseFolder: () => folderInputRef.current?.click(),
    };
    return () => { triggersRef.current = null; };
  }, [triggersRef]);

  // Wrong-extension files are filtered before they ever queue — tell the user
  // rather than dropping them silently.
  const noteSkipped = (n: number) => {
    if (n > 0 && mode === 'kh-add') {
      addToast({ type: 'info', message: `${n} file${n > 1 ? 's' : ''} skipped — supported types: ${KH_ALLOWED_LABEL}.` });
    }
  };

  // Validate a queued file, then either flip it to an error row (with a reason)
  // or run the upload simulation through to "ready". Catches the edge cases a
  // real ingest must reject: empty, oversized, password-protected, corrupt.
  const runUpload = async (localId: string, file: File) => {
    const res = await validateUploadFile(file);
    if (!res.ok) {
      setPendingUploads(prev => prev.map(p => p.localId === localId
        ? { ...p, status: 'error' as const, error: res.reason } : p));
      // Tell the user why + that it must go before they can add the batch.
      addToast({ type: 'error', message: `${file.name} — ${res.reason}. Remove it to continue.` });
      return;
    }
    setPendingUploads(prev => prev.map(p => p.localId === localId ? { ...p, status: 'uploading' as const } : p));
    const step = 5 + Math.round(Math.random() * 7); // ~1.5s total
    const t = window.setInterval(() => {
      setPendingUploads(prev => {
        const current = prev.find(p => p.localId === localId);
        // Row was removed (user clicked Cancel mid-upload) — stop the timer so
        // it doesn't fire setState forever.
        if (!current) {
          clearInterval(t);
          intervalsRef.current = intervalsRef.current.filter(id => id !== t);
          return prev;
        }
        const next = prev.map(p => p.localId === localId
          ? { ...p, progress: Math.min(100, p.progress + step) } : p);
        const updated = next.find(p => p.localId === localId)!;
        if (updated.progress >= 100) {
          clearInterval(t);
          intervalsRef.current = intervalsRef.current.filter(id => id !== t);
          return next.map(p => p.localId === localId ? { ...p, status: 'ready' as const } : p);
        }
        return next;
      });
    }, 100);
    intervalsRef.current.push(t);
  };

  // Add a batch of {file, path}. Dedupes against what's already queued AND
  // within the batch itself (a dropped folder can contain repeats). Keyed by
  // path+size, not name+size, so two same-named files in different folders are
  // both kept. Then validates + uploads each fresh file.
  const addFiles = (batch: Array<{ file: File; path: string }>) => {
    if (batch.length === 0) return;
    const seen = new Set(pendingUploads.map(p => `${p.path ?? p.name}:${p.sizeBytes}`));
    const fresh = batch.filter(b => {
      const key = `${b.path}:${b.file.size}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const dupes = batch.length - fresh.length;
    if (dupes > 0) addToast({ type: 'info', message: `${dupes} duplicate file${dupes > 1 ? 's' : ''} skipped.` });
    if (fresh.length === 0) return;

    const ts = Date.now();
    const incoming: PendingUpload[] = fresh.map((b, i) => ({
      localId: `up-${ts}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      name: b.file.name,
      sizeBytes: b.file.size,
      progress: 0,
      path: b.path !== b.file.name ? b.path : undefined,
      file: b.file,
      status: 'validating',
    }));

    setPendingUploads(prev => [...incoming, ...prev]);
    incoming.forEach((uf, i) => { void runUpload(uf.localId, fresh[i].file); });
  };

  // File-input handler — flat list of files, no folder structure.
  const handleFileInput = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const all = Array.from(fileList);
    const accepted = all.filter(f => isAllowedForMode(f.name, mode));
    noteSkipped(all.length - accepted.length);
    addFiles(accepted.map(f => ({ file: f, path: f.name })));
  };

  // Folder-input handler — files have webkitRelativePath set to "Folder/sub/file.ext".
  const handleFolderInput = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const all = Array.from(fileList);
    const accepted = all.filter(f => isAllowedForMode(f.name, mode));
    noteSkipped(all.length - accepted.length);
    addFiles(accepted.map(f => {
      const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
      return { file: f, path: rel || f.name };
    }));
  };

  // Drop handler — uses entry walker so dropped folders work.
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const { files, skipped } = await walkItems(e.dataTransfer.items, mode);
      noteSkipped(skipped);
      addFiles(files);
    } else if (e.dataTransfer.files) {
      handleFileInput(e.dataTransfer.files);
    }
  };

  // The drop zone fills the body only while nothing is picked yet. As soon as any
  // file is uploaded OR any existing source is selected, it collapses to a compact
  // bar (Choose files / Choose folder) with the combined list below it.
  const empty = pendingUploads.length === 0 && selectedSources.length === 0;
  const totalItems = pendingUploads.length + selectedSources.length;

  return (
    <div
      className="flex flex-col min-h-0 h-full px-6 py-3 gap-3"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* Hidden inputs — the Choose files / Choose folder buttons now live in the
          tab row (rendered by DataPickerModal) and trigger these via triggersRef. */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        {...(mode === 'kh-add' ? { accept: KH_ALLOWED_ACCEPT } : {})}
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

      {empty && (
        // Default (empty) drop zone — fills the body with the centered pick buttons. Untouched.
        <div className={`flex-1 flex flex-col items-center justify-center text-center rounded-xl border-2 border-dashed transition-colors px-6 py-7 ${
          isDragging ? 'border-brand-600 bg-brand-50' : 'border-paper-200 bg-canvas'
        }`}>
          <Upload size={24} className={`mb-2 ${isDragging ? 'text-brand-600' : 'text-ink-400'}`} />
          <p className="text-[0.875rem] text-ink-700 font-medium">Drop files or a folder here</p>
          <p className="text-[0.75rem] text-ink-500 mt-1">or pick from your computer</p>
          <div className="inline-flex items-center gap-2 mt-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 h-10 rounded-md bg-brand-600 hover:bg-brand-500 active:bg-brand-800 text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer"
            >
              <Upload size={14} />
              Choose files
            </button>
            <button
              onClick={() => folderInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 h-10 rounded-md border border-paper-200 bg-paper-0 text-ink-800 hover:border-brand-300 hover:bg-brand-50 text-[0.8125rem] font-semibold transition-colors cursor-pointer"
            >
              <Folder size={14} />
              Choose folder
            </button>
          </div>
          {mode === 'kh-add' && (
            <p className="text-[0.6875rem] text-ink-400 mt-3">{KH_ALLOWED_LABEL}</p>
          )}
        </div>
      )}

      {/* Combined list — every picked item in one place: fresh uploads AND the
          existing sources ticked on the data tabs. Each row is removable (the
          parent confirms first). Folder uploads keep their path tag inline. */}
      {!empty && (
        <div className={`flex-1 min-h-0 flex flex-col rounded-lg border bg-white overflow-hidden transition-colors ${isDragging ? 'border-brand-600 ring-2 ring-brand-200' : 'border-paper-200'}`}>
          <div className="shrink-0 px-4 py-2 border-b border-paper-200 bg-canvas flex items-center justify-between">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-500">
              Selected &amp; uploaded · {totalItems}
            </span>
            {(() => {
              const inFlight = pendingUploads.filter(u => u.status === 'validating' || u.status === 'uploading').length;
              const failed = pendingUploads.filter(u => u.status === 'error').length;
              if (inFlight > 0) return (
                <span className="inline-flex items-center gap-1 text-[0.75rem] font-semibold text-brand-600">
                  <Loader2 size={10} className="animate-spin" />
                  Uploading {inFlight}…
                </span>
              );
              if (failed > 0) return (
                <span className="inline-flex items-center gap-1 text-[0.75rem] font-semibold text-risk">
                  <AlertTriangle size={10} />
                  {failed} failed
                </span>
              );
              return null;
            })()}
          </div>

          <ul className="flex-1 min-h-0 overflow-y-auto divide-y divide-paper-200">
            <AnimatePresence initial={false}>
              {/* Failed files float to the top (stable sort keeps each group's
                  order) so the thing blocking the Add button is always in view. */}
              {[...pendingUploads]
                .sort((a, b) => Number(b.status === 'error') - Number(a.status === 'error'))
                .map((u, idx) => (
                <PendingFileRow
                  key={u.localId}
                  upload={u}
                  onRemove={(id) => onRequestRemove({ kind: 'upload', id, name: u.name })}
                  indent={false}
                  idx={idx}
                  reduced={!!prefersReducedMotion}
                />
              ))}
            </AnimatePresence>
            {/* Selected existing sources — static rows, removable (un-ticks the source). */}
            {selectedSources.map(s => {
              const { icon: Icon, label: typeLabel } = TYPE_META[s.type];
              return (
                <li key={`src-${s.id}`} className="flex items-center gap-3 py-3 px-4">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-brand-50 text-brand-700">
                    <Icon size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[0.8125rem] truncate text-ink-800">{s.name}</div>
                    <div className="text-[0.6875rem] text-ink-500 mt-0.5 truncate">{s.subtype} · {formatDate(s.createdAt)}</div>
                  </div>
                  <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[0.75rem] font-semibold text-ink-600 bg-paper-100">{typeLabel}</span>
                  <button
                    onClick={() => onRequestRemove({ kind: 'source', id: s.id, name: s.name })}
                    className="p-1.5 text-ink-400 hover:text-risk hover:bg-canvas rounded-md transition-colors cursor-pointer shrink-0"
                    aria-label={`Remove ${s.name}`}
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
      <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4 space-y-4">
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
                      : 'border-paper-200 bg-paper-0 hover:border-brand-300 hover:bg-brand-50'
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
              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md border border-paper-200 bg-paper-0 text-[0.75rem] font-semibold text-ink-800 hover:border-brand-300 hover:bg-brand-50 disabled:bg-canvas disabled:text-ink-400 disabled:border-paper-200 disabled:cursor-not-allowed transition-colors cursor-pointer"
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

      {/* Footer — cool canvas strip, helper on left, action group on right. */}
      <div className="border-t border-paper-200 px-6 py-3 flex items-center justify-between bg-canvas">
        <span className="text-[0.75rem] text-ink-500">Credentials are stored encrypted.</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 h-9 rounded-md border border-paper-200 bg-paper-0 text-[0.75rem] font-semibold text-ink-800 hover:border-brand-300 hover:bg-brand-50 transition-colors cursor-pointer"
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
  'w-full h-10 px-3 rounded-md border border-paper-200 bg-paper-0 text-[0.8125rem] text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 disabled:bg-canvas disabled:text-ink-400 disabled:cursor-not-allowed transition-colors';

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
  upload, onRemove, indent, idx = 0, reduced = false,
}: { upload: PendingUpload; onRemove: (id: string) => void; indent: boolean; idx?: number; reduced?: boolean }) {
  const isReady = upload.status === 'ready';
  const isError = upload.status === 'error';
  const isValidating = upload.status === 'validating';
  const isUploading = upload.status === 'uploading';
  const isPasswordErr = isError && /password|unlock/i.test(upload.error ?? '');
  // Path tag = the directory portion of the path (everything except the
  // file name itself). Empty when file is loose.
  const pathTag = upload.path && upload.path !== upload.name
    ? upload.path.replace(`/${upload.name}`, '') || upload.path
    : '';
  const LeadIcon = isError ? (isPasswordErr ? Lock : AlertTriangle) : (pathTag ? Folder : FileText);
  const leadTone = isError ? 'text-risk' : isReady ? 'text-brand-600' : 'text-ink-400';
  return (
    <motion.li
      layout
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
      transition={{ duration: 0.26, delay: Math.min(idx, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className={`overflow-hidden flex items-center gap-3 py-3 ${indent ? 'pl-10 pr-4' : 'px-4'}`}
    >
      <LeadIcon size={14} className={`shrink-0 ${leadTone}`} />
      <div className="flex-1 min-w-0">
        <div className={`text-[0.8125rem] truncate ${isError ? 'text-ink-600' : 'text-ink-800'}`}>
          {upload.name}
          {pathTag && (
            <span className="ml-1.5 text-[0.6875rem] text-ink-400 font-normal" title={upload.path}>
              · {pathTag}
            </span>
          )}
        </div>
        {isUploading && (
          <div className="mt-1.5 h-1.5 rounded-full bg-paper-200 overflow-hidden">
            <motion.div
              className="h-full bg-brand-600"
              initial={{ width: 0 }}
              animate={{ width: `${upload.progress}%` }}
              transition={{ duration: 0.18, ease: 'linear' }}
            />
          </div>
        )}
        <div className={`text-[0.6875rem] tabular-nums mt-1 ${isError ? 'text-risk font-medium' : 'text-ink-500'}`}>
          {isError ? upload.error : formatBytesShort(upload.sizeBytes)}
        </div>
      </div>
      {/* Status pill — a centered trailing element (sibling of the remove
          button), so it lines up with the lead icon and the X instead of
          riding the filename's line. */}
      {isReady && (
        <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[0.75rem] font-semibold text-compliant bg-compliant-50">
          <Check size={10} />
          Ready
        </span>
      )}
      {isError && (
        <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[0.75rem] font-semibold text-risk bg-risk-50">
          <AlertTriangle size={10} />
          Failed
        </span>
      )}
      {isValidating && (
        <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[0.75rem] font-semibold text-ink-500 bg-canvas">
          <Loader2 size={10} className="animate-spin" />
          Checking…
        </span>
      )}
      {isUploading && (
        <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[0.75rem] font-semibold text-brand-700 bg-brand-50">
          <Loader2 size={10} className="animate-spin" />
          {upload.progress}%
        </span>
      )}
      <button
        onClick={() => onRemove(upload.localId)}
        className="p-1.5 text-ink-400 hover:text-risk hover:bg-canvas rounded-md transition-colors cursor-pointer shrink-0"
        aria-label={`${isReady || isError ? 'Remove' : 'Cancel'} ${upload.name}`}
      >
        <X size={13} />
      </button>
    </motion.li>
  );
}

