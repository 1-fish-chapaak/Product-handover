import { useState, useMemo, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Database, FileText, Layers, FolderOpen,
  Search, Upload, MoreHorizontal, Plus, X,
  Pencil, Trash2, Unplug, Check,
  MessageSquare, AlertTriangle,
  LayoutGrid, Rows3,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import { Button } from '../shared/Button';
import {
  DateFilterPicker, dateInFilter, isDateFilterActive, dateFilterLabel,
  DEFAULT_DATE_FILTER, type DateFilter,
} from '../shared/DateFilterPicker';
import DataSourceDetailView from './DataSourceDetailView';
import DataPickerModal, { type AttachmentSelection } from '../chat/DataPickerModal';
import ConfirmationModal from '../shared/ConfirmationModal';
import {
  TODAY, INTEGRATED_TYPES, TYPE_META, formatDate,
  type DataSource, type SourceType,
} from './sources';
import {
  DATASET_FILES, setSourceFiles, removeSourceFiles, metaForFormat, registerFileBlob, countSheetRows, countPdfPages, type FileFormat,
} from './datasetFiles';
import { useKnowledgeSources } from '../../hooks/useKnowledgeSources';

// ─── Upload helpers ──────────────────────────────────────────────────────────

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;
function formatBytesShort(bytes: number): string {
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;
  if (bytes < GB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / GB).toFixed(1)} GB`;
}

function formatExt(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot < 0 || dot === name.length - 1) return 'FILE';
  return name.slice(dot + 1).toUpperCase();
}

// Map a filename's extension onto the DatasetFile FileFormat enum. Unknown
// extensions default to PDF (most common doc upload).
function fileFormat(name: string): FileFormat {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  if (ext === 'csv')  return 'CSV';
  if (ext === 'xlsx') return 'XLSX';
  return 'PDF';
}

// First path segment, or null if the file isn't in any folder.
function rootFolder(path: string | undefined, name: string): string | null {
  if (!path || path === name) return null;
  const sep = path.indexOf('/');
  return sep > 0 ? path.slice(0, sep) : null;
}

// Append (2), (3)… until the name doesn't collide with anything already in use.
function dedupeName(desired: string, taken: Set<string>): string {
  if (!taken.has(desired)) return desired;
  const dot = desired.lastIndexOf('.');
  const base = dot > 0 ? desired.slice(0, dot) : desired;
  const ext  = dot > 0 ? desired.slice(dot) : '';
  let i = 2;
  while (taken.has(`${base} (${i})${ext}`)) i += 1;
  return `${base} (${i})${ext}`;
}

// ─── Tab definitions ─────────────────────────────────────────────────────────
// Single richer segment — replaces the older 4-tab grouping that lumped
// databases/APIs/cloud/sessions into a single "Integrations" bucket. With
// granular tabs each carries a count, so users can scope by exact source type.

type TabId = 'all' | 'file' | 'folder' | 'integrated';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'all',        label: 'All',             icon: Layers },
  { id: 'file',       label: 'Files',           icon: FileText },
  { id: 'folder',     label: 'Folders',         icon: FolderOpen },
  { id: 'integrated', label: 'Integrated DBs',  icon: Database },
];

type ViewMode = 'grid' | 'list';

const PAGE_SIZE = 6;


// Parse "Folder · 12 files · 84.2 MB" or "CSV · 4.8 MB" — best-effort size sum
// so the header can show total indexed bytes. Unrecognized sources contribute 0.
function parseSizeBytes(subtype: string): number {
  const m = subtype.match(/([\d.]+)\s*(KB|MB|GB|TB)\b/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  if (Number.isNaN(n)) return 0;
  const unit = m[2].toUpperCase();
  if (unit === 'KB') return n * 1024;
  if (unit === 'MB') return n * 1024 * 1024;
  if (unit === 'GB') return n * 1024 * 1024 * 1024;
  return n * 1024 * 1024 * 1024 * 1024;
}

// Deterministic pseudo-health for live integrations — used purely for visual
// signal. Most read healthy; ~10% degraded so the dot vocabulary is visible.
function integrationHealth(source: DataSource): 'healthy' | 'degraded' {
  // Explicit override (seed data) wins; otherwise fall back to a deterministic
  // hash so live-uploaded integrations still show a mix of healthy/degraded.
  if (source.health) return source.health;
  let h = 0;
  const id = source.id;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % 10 === 0 ? 'degraded' : 'healthy';
}

function formatRel(iso: string, now: Date): string {
  const ms = Math.max(0, now.getTime() - new Date(iso).getTime());
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Aggregate stats published to the parent (Knowledge Hub header).
export interface HubStats {
  total: number;
  files: number;
  folders: number;
  integrations: number;
  totalBytes: number;
  lastAdded?: string;
  /** Count of integrations whose health reads as 'degraded' — drives the
   *  Knowledge Hub attention rail. Zero when there is nothing to action. */
  attentionCount: number;
  /** First degraded integration's id — used so the attention rail can deep-
   *  link straight into the side panel for that source. */
  firstAttentionId?: string;
  /** First degraded integration's display name — used in the rail copy so
   *  the user sees what's broken before they click. */
  firstAttentionName?: string;
  /** Distinct source types currently connected (e.g. ['database','api','file']).
   *  Used by the Knowledge Hub starter-prompt chips to show only those whose
   *  required source-type is actually present. */
  connectedTypes: SourceType[];
  /** Per-type counts. Drives the "By type" breakdown card on the Knowledge
   *  Hub. Excludes folders — those are counted separately in `folders`. */
  typeBreakdown: Partial<Record<SourceType, number>>;
  /** Last 3 sources by createdAt, newest first. Powers the "Recently added"
   *  card so the page doesn't need a second hook subscription. */
  recentSources: DataSource[];
  /** Where the source list is currently stored. Drives the "Stored in this
   *  browser" cue on the page header — pulled from useKnowledgeSources. */
  backend: 'local' | 'cloud';
}

// ─── Time bucketing ──────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

interface Bucket { id: string; label: string; items: DataSource[]; }

function bucketByDate(items: DataSource[]): Bucket[] {
  const buckets: Bucket[] = [
    { id: 'today',   label: 'Today',       items: [] },
    { id: 'week',    label: 'Last 7 days', items: [] },
    { id: 'earlier', label: 'Earlier',     items: [] },
  ];
  items.forEach(d => {
    const created = new Date(d.createdAt);
    const ageMs = TODAY.getTime() - created.getTime();
    if (created.toDateString() === TODAY.toDateString()) buckets[0].items.push(d);
    else if (ageMs < 7 * DAY_MS) buckets[1].items.push(d);
    else buckets[2].items.push(d);
  });
  return buckets.filter(b => b.items.length > 0);
}

// ─── Source card ─────────────────────────────────────────────────────────────

interface SourceCardProps {
  source: DataSource;
  onOpen: () => void;
  /** Signal that the user clicked Remove/Disconnect in the menu. The parent
   *  shows a confirmation modal and only then performs the removal. */
  onRemove: (id: string) => void;
  /** Persist an inline rename triggered from the card's 3-dot menu. */
  onRename: (id: string, newName: string) => void;
  /** True whenever ANY source is currently selected — promotes the hover-only
   *  checkbox into a persistent visible one across all cards. */
  isSelecting: boolean;
  selected: boolean;
  /** Shift-clicks come through with shift=true so the parent can range-extend. */
  onToggleSelect: (id: string, opts?: { shift?: boolean }) => void;
  viewMode: ViewMode;
}

// Shared remove + click handlers — used by both card and row renderers. The
// parent owns the confirmation modal and the post-confirm toast; this hook
// just signals "user clicked Remove on this card" via onRemove(id).
function useCardActions(
  source: DataSource,
  onOpen: () => void,
  onRemove: (id: string) => void,
  isSelecting: boolean,
  onToggleSelect: (id: string, opts?: { shift?: boolean }) => void,
) {
  const isIntegrated = INTEGRATED_TYPES.includes(source.type);
  const handleRemove = () => onRemove(source.id);
  // Body click: in selection mode, any click toggles. Outside selection,
  // open the detail. Shift always toggles (and ranges).
  const handleCardClick = (e: React.MouseEvent) => {
    if (isSelecting || e.shiftKey) onToggleSelect(source.id, { shift: e.shiftKey });
    else onOpen();
  };
  return { handleRemove, handleCardClick, isIntegrated };
}

// Health pill for integrations — small status chip with colored dot + label.
// Reads stronger than a single grey "healthy" text label so the card's
// status is scannable at a glance.
function HealthDot({ health }: { health: 'healthy' | 'degraded' }) {
  const tone = health === 'healthy'
    ? 'bg-compliant-50 text-compliant-700'
    : 'bg-mitigated-50 text-mitigated-700';
  const dot = health === 'healthy' ? 'bg-compliant' : 'bg-mitigated';
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[0.625rem] font-semibold uppercase tracking-wider ${tone}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden />
      {health}
    </span>
  );
}

function SourceCard(props: SourceCardProps) {
  return props.viewMode === 'list'
    ? <SourceRow {...props} />
    : <SourceTile {...props} />;
}

// Inline rename editor — input + save/cancel. Shared by the grid tile and list
// row. Auto-selects on mount; Enter/blur commits, Escape cancels. The save and
// cancel buttons use onMouseDown-preventDefault so clicking them doesn't blur
// the input first (which would fire a commit before the click registers).
function InlineRename({ initial, onCommit, onCancel }: {
  initial: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.select(); }, []);
  const commit = () => {
    const n = draft.trim();
    if (n && n !== initial) onCommit(n);
    else onCancel();
  };
  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0" onClick={e => e.stopPropagation()}>
      <input
        ref={ref}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); else if (e.key === 'Escape') onCancel(); }}
        onBlur={commit}
        className="flex-1 min-w-0 h-8 px-2.5 text-[0.875rem] font-semibold text-ink-900 bg-canvas-elevated border border-brand-600 rounded-lg focus:outline-none focus:ring-4 focus:ring-brand-600/15"
      />
      <button onMouseDown={e => e.preventDefault()} onClick={commit} className="p-1.5 text-brand-700 hover:bg-brand-50 rounded-md cursor-pointer shrink-0 transition-colors" aria-label="Save name">
        <Check size={15} />
      </button>
      <button onMouseDown={e => e.preventDefault()} onClick={onCancel} className="p-1.5 text-ink-500 hover:bg-paper-50 rounded-md cursor-pointer shrink-0 transition-colors" aria-label="Cancel rename">
        <X size={15} />
      </button>
    </div>
  );
}

// Grid tile — primary card, slightly richer than the previous version. Folders
// get a count chip; integrations get a health dot + last sync.
function SourceTile({
  source, onOpen, onRemove, onRename,
  isSelecting, selected, onToggleSelect,
}: SourceCardProps) {
  const [editing, setEditing] = useState(false);
  // Icon reflects what the source is: a folder glyph for folders, the file
  // glyph for files, and the per-type glyph (DB / API / cloud / session) for
  // integrations. One calm brand tile tone for all so the grid stays quiet —
  // the icon carries identity, the uppercase FORMAT label confirms it.
  const Icon: React.ElementType = source.isFolder ? FolderOpen : TYPE_META[source.type].icon;
  const tone = 'text-brand-700 bg-brand-50';
  const [menuOpen, setMenuOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const { handleRemove, handleCardClick, isIntegrated } = useCardActions(
    source, onOpen, onRemove, isSelecting, onToggleSelect,
  );
  const health = isIntegrated ? integrationHealth(source) : null;

  // For files/folders: pull the size/count tail (everything after the format
  // token) so the footer reads "4.2 KB · May 28, 2026" without repeating the
  // type the icon and filename already convey.
  const sizeTail = !isIntegrated
    ? source.subtype.split('·').slice(1).map(s => s.trim()).join(' · ')
    : '';

  // Editing replaces the whole card with an inline rename row (icon + input +
  // save/cancel) so the <input> never nests inside the card <button>.
  if (editing) {
    return (
      <div className="relative">
        <div className="w-full flex items-center gap-3 px-4 py-3.5 rounded-lg bg-canvas-elevated border border-brand-500">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
            <Icon size={18} />
          </div>
          <InlineRename
            initial={source.name}
            onCommit={(n) => { onRename(source.id, n); setEditing(false); }}
            onCancel={() => setEditing(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <motion.button
        type="button"
        onClick={handleCardClick}
        aria-pressed={selected || undefined}
        whileHover={prefersReducedMotion ? undefined : { y: -3, boxShadow: '0 8px 24px -10px rgb(15 8 30 / 0.16)' }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={`group w-full flex items-center gap-3 px-4 py-3.5 rounded-lg bg-canvas-elevated border transition-colors duration-200 cursor-pointer text-left ${
          selected
            ? 'border-brand-500 bg-brand-50/50'
            : 'border-canvas-border hover:border-brand-300'
        }`}
      >
        {/* Icon tile + overlaid hover checkbox. The checkbox is absolute
            inside the icon container so layout never shifts between selecting
            and non-selecting states. Hover or `isSelecting` reveals it; the
            icon stays visible underneath at reduced opacity. */}
        <div className={`relative w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
          <Icon
            size={18}
            className={`transition-opacity duration-150 ${
              selected ? 'opacity-0' : isSelecting ? 'opacity-30 group-hover:opacity-0' : 'opacity-100 group-hover:opacity-30'
            }`}
          />
          <span
            role="checkbox"
            aria-checked={selected}
            aria-label={selected ? `Deselect ${source.name}` : `Select ${source.name}`}
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onToggleSelect(source.id, { shift: e.shiftKey }); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                e.preventDefault();
                onToggleSelect(source.id, { shift: e.shiftKey });
              }
            }}
            className={`absolute inset-0 m-auto w-4 h-4 rounded border flex items-center justify-center transition-opacity duration-150 cursor-pointer ${
              selected
                ? 'bg-brand-600 border-brand-600 text-white opacity-100'
                : isSelecting
                  ? 'bg-paper-0 border-ink-300 opacity-100 hover:border-brand-500'
                  : 'bg-paper-0 border-ink-300 opacity-0 group-hover:opacity-100 hover:border-brand-500'
            }`}
          >
            {selected && <Check size={11} strokeWidth={3} />}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[0.875rem] font-semibold text-ink-900 truncate leading-tight" title={source.name}>
            {source.name}
          </div>
          {/* Footer: size/count · date  OR  Connected. The format (CSV / PDF /
              FOLDER) is intentionally NOT repeated here — the icon already
              names the type and the filename already carries the extension.
              Inline display so wrap kicks in only on genuine overflow. */}
          <div className="mt-1 text-[0.75rem] text-ink-500 tabular-nums leading-snug">
            {isIntegrated ? (
              <span className={`font-medium ${health === 'degraded' ? 'text-mitigated-700' : 'text-brand-700'}`}>
                {health === 'degraded' ? 'Needs reconnection' : 'Connected'}
              </span>
            ) : (
              <>
                {sizeTail && <>
                  <span className="whitespace-nowrap">{sizeTail}</span>
                  <span className="text-ink-300 mx-1.5" aria-hidden>·</span>
                </>}
                <span className="whitespace-nowrap">{formatDate(source.displayDate ?? source.createdAt)}</span>
              </>
            )}
          </div>
        </div>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); setMenuOpen(o => !o); } }}
          className={`p-1 rounded-md text-ink-400 hover:text-ink-700 hover:bg-paper-50 transition-opacity cursor-pointer shrink-0 ${
            menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100'
          }`}
          aria-label="Source actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <MoreHorizontal size={16} />
        </span>
      </motion.button>
      {menuOpen && (
        <SourceMenu
          source={source}
          onClose={() => setMenuOpen(false)}
          onRequestRemove={handleRemove}
          onRename={() => { setMenuOpen(false); setEditing(true); }}
        />
      )}
    </div>
  );
}

// Dense list row — single line, scannable. Same affordances as the tile.
function SourceRow({
  source, onOpen, onRemove, onRename,
  isSelecting, selected, onToggleSelect,
}: SourceCardProps) {
  const [editing, setEditing] = useState(false);
  const { label: typeLabel } = TYPE_META[source.type];
  const Icon: React.ElementType = source.isFolder ? FolderOpen : TYPE_META[source.type].icon;
  const tone = 'text-brand-700 bg-brand-50';
  const [menuOpen, setMenuOpen] = useState(false);
  const { handleRemove, handleCardClick, isIntegrated } = useCardActions(
    source, onOpen, onRemove, isSelecting, onToggleSelect,
  );
  const health = isIntegrated ? integrationHealth(source) : null;
  const displayType = source.isFolder ? 'Folder' : typeLabel;
  // Detail column: drop the leading format token for files/folders (it repeats
  // the Type column, the icon, and the filename extension). Integrations keep
  // their full subtype because the first token is the engine ("Oracle",
  // "Snowflake"), which is real information shown nowhere else.
  const detail = isIntegrated
    ? source.subtype
    : source.subtype.split('·').slice(1).map(s => s.trim()).join(' · ');

  if (editing) {
    return (
      <div className="relative">
        <div className="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg border border-brand-500 bg-canvas-elevated">
          <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${tone}`}>
            <Icon size={13} />
          </div>
          <InlineRename
            initial={source.name}
            onCommit={(n) => { onRename(source.id, n); setEditing(false); }}
            onCancel={() => setEditing(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleCardClick}
        aria-pressed={selected || undefined}
        className={`group w-full flex items-center gap-3 px-3 h-10 rounded-lg border transition-colors cursor-pointer text-left ${
          selected
            ? 'border-brand-600 bg-brand-50/30'
            : 'border-transparent hover:border-canvas-border hover:bg-canvas-elevated'
        }`}
      >
        {/* Hover-revealed checkbox overlaying the type-icon tile. Same layout
            slot regardless of state so nothing shifts. */}
        <div className={`relative w-6 h-6 rounded flex items-center justify-center shrink-0 ${tone}`}>
          <Icon
            size={13}
            className={`transition-opacity duration-150 ${
              selected ? 'opacity-0' : isSelecting ? 'opacity-40 group-hover:opacity-0' : 'opacity-100 group-hover:opacity-30'
            }`}
          />
          <span
            role="checkbox"
            aria-checked={selected}
            aria-label={selected ? `Deselect ${source.name}` : `Select ${source.name}`}
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onToggleSelect(source.id, { shift: e.shiftKey }); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                e.preventDefault();
                onToggleSelect(source.id, { shift: e.shiftKey });
              }
            }}
            className={`absolute inset-0 m-auto w-4 h-4 rounded-[5px] border flex items-center justify-center transition-opacity duration-150 cursor-pointer ${
              selected
                ? 'bg-brand-600 border-brand-600 text-white opacity-100'
                : isSelecting
                  ? 'bg-paper-0 border-ink-300 opacity-100 hover:border-brand-500'
                  : 'bg-paper-0 border-ink-300 opacity-0 group-hover:opacity-100 hover:border-brand-500'
            }`}
          >
            {selected && <Check size={11} strokeWidth={3} />}
          </span>
        </div>
        <div className="flex-1 min-w-0 text-[0.8125rem] font-semibold text-ink-900 truncate" title={source.name}>
          {source.name}
        </div>
        <div className="hidden lg:block w-24 text-[0.6875rem] uppercase tracking-wide font-mono text-ink-500 shrink-0">
          {displayType}
        </div>
        <div className="hidden md:block flex-1 max-w-[18rem] text-[0.75rem] text-ink-500 truncate tabular-nums">
          {detail}
        </div>
        <div className="hidden md:flex items-center gap-2 shrink-0 w-32 justify-end">
          {health && <HealthDot health={health} />}
        </div>
        <div className="text-[0.75rem] text-ink-400 tabular-nums shrink-0 w-24 text-right">
          {formatDate(source.displayDate ?? source.createdAt)}
        </div>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); setMenuOpen(o => !o); } }}
          className={`p-1 rounded-md text-ink-400 hover:text-ink-700 hover:bg-paper-100 transition-opacity cursor-pointer shrink-0 ${
            menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100'
          }`}
          aria-label="Source actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <MoreHorizontal size={15} />
        </span>
      </button>
      {menuOpen && (
        <SourceMenu
          source={source}
          onClose={() => setMenuOpen(false)}
          onRequestRemove={handleRemove}
          onRename={() => { setMenuOpen(false); setEditing(true); }}
        />
      )}
    </div>
  );
}

// ─── Source actions menu ─────────────────────────────────────────────────────
// Two items per menu: Rename (shortcut into the detail view's rename mode) and
// the destructive lifecycle action (Remove for files, Disconnect for DB/API/
// cloud/session). The destructive action is optimistic — see SourceCard for
// the undo toast wiring.

interface SourceMenuProps {
  source: DataSource;
  onClose: () => void;
  onRequestRemove: () => void;
  onRename: () => void;
}

function SourceMenu({ source, onClose, onRequestRemove, onRename }: SourceMenuProps) {
  const isIntegrated = INTEGRATED_TYPES.includes(source.type);

  // Wraps a handler so it always closes the menu after firing.
  const handle = (fn: () => void) => () => { fn(); onClose(); };

  return (
    <>
      {/* Backdrop — captures outside clicks. Invisible. */}
      <div className="fixed inset-0 z-30" onClick={onClose} aria-hidden />
      <div
        role="menu"
        className="absolute right-2 top-12 z-40 w-48 rounded-lg border border-paper-200 bg-paper-0 shadow-md py-1"
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem icon={Pencil} label="Rename" onClick={handle(onRename)} />
        <MenuSeparator />
        {isIntegrated ? (
          <MenuItem icon={Unplug} label="Disconnect" onClick={handle(onRequestRemove)} destructive />
        ) : (
          <MenuItem icon={Trash2} label="Remove" onClick={handle(onRequestRemove)} destructive />
        )}
      </div>
    </>
  );
}

function MenuItem({
  icon: Icon, label, onClick, destructive,
}: { icon: React.ElementType; label: string; onClick: () => void; destructive?: boolean }) {
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 h-8 text-[0.75rem] font-medium text-left transition-colors cursor-pointer ${
        destructive
          ? 'text-risk-700 hover:bg-risk-50'
          : 'text-ink-800 hover:bg-paper-50'
      }`}
    >
      <Icon size={13} className="shrink-0" />
      {label}
    </button>
  );
}

function MenuSeparator() {
  return <div className="h-px bg-paper-200 my-1" aria-hidden />;
}

// ─── Filter chip ─────────────────────────────────────────────────────────────
// Small dismissible chip used in the active-filters bar. Clear-on-X removes
// just that one filter dimension without touching the others.

function FilterChip({ label, onClear }: { label: React.ReactNode; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1 h-7 rounded-full bg-brand-50 border border-brand-100 text-[0.75rem] text-brand-700">
      {label}
      <button
        onClick={onClear}
        className="p-0.5 rounded-full hover:bg-brand-100 cursor-pointer"
        aria-label="Clear this filter"
      >
        <X size={11} />
      </button>
    </span>
  );
}


// ─── Per-tab empty state ─────────────────────────────────────────────────────
// One component handles all empty branches: filter-empty, type-empty for each
// of the granular type tabs, and the catch-all. Each branch picks an icon,
// copy, and CTA appropriate to the active tab so the user always sees a
// "what would I do next" rather than a flat "no items".

interface PerTabEmptyStateProps {
  isFiltered: boolean;
  tab: TabId;
  search: string;
  dateActive: boolean;
  dateLabel: string;
  onOpenPicker: () => void;
  onRequestIntegration: () => void;
}

function PerTabEmptyState({
  isFiltered, tab, search, dateActive, dateLabel,
  onOpenPicker, onRequestIntegration,
}: PerTabEmptyStateProps) {
  if (isFiltered) {
    return (
      <EmptyShell icon={Search}>
        <p className="text-[0.875rem] text-ink-700 font-medium">No sources match your filters.</p>
        <p className="text-[0.75rem] text-ink-500 mt-1">
          {search.trim() && <>Search "<span className="font-semibold">{search.trim()}</span>" · </>}
          {dateActive && <>Date "<span className="font-semibold">{dateLabel}</span>" · </>}
          Try widening the range or clearing filters.
        </p>
      </EmptyShell>
    );
  }

  // Per-type guidance. The CTA splits between "Add source" (which works for
  // file-like and DB tabs through the unified picker) and "Request integration"
  // for the read-only-from-IT cases (cloud / api / sessions).
  if (tab === 'folder') {
    return (
      <EmptyShell icon={FolderOpen}>
        <p className="text-[0.875rem] text-ink-700 font-medium">No folders uploaded yet.</p>
        <p className="text-[0.75rem] text-ink-500 mt-1 max-w-md mx-auto">
          Drop a folder via Add source, and IRA bundles its files into one card.
        </p>
        <div className="mt-4">
          <Button variant="primary" leftIcon={<Plus size={13} />} onClick={onOpenPicker}>Add source</Button>
        </div>
      </EmptyShell>
    );
  }

  if (tab === 'integrated') {
    return (
      <EmptyShell icon={Database}>
        <p className="text-[0.875rem] text-ink-700 font-medium">No integrations connected yet.</p>
        <p className="text-[0.75rem] text-ink-500 mt-1 max-w-md mx-auto">
          Connect PostgreSQL, MySQL, Snowflake, Oracle, SQL Server and BigQuery
          from the Add source picker.
        </p>
        <div className="mt-4">
          <Button variant="primary" leftIcon={<Plus size={13} />} onClick={onOpenPicker}>Connect a source</Button>
        </div>
      </EmptyShell>
    );
  }

  // Catch-all: 'all' or 'file' with no items.
  return (
    <EmptyShell icon={Upload}>
      <p className="text-[0.875rem] text-ink-700 font-medium">No sources connected yet.</p>
      <p className="text-[0.75rem] text-ink-500 mt-1">Upload a file or connect a source to get started.</p>
      <div className="mt-4">
        <Button variant="primary" leftIcon={<Plus size={13} />} onClick={onOpenPicker}>Add source</Button>
      </div>
    </EmptyShell>
  );
}

function EmptyShell({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="text-center py-16 rounded-lg border border-dashed border-canvas-border bg-canvas-elevated">
      <div className="w-12 h-12 rounded-full bg-paper-50 flex items-center justify-center mx-auto mb-3">
        <Icon size={20} className="text-ink-400" />
      </div>
      {children}
    </div>
  );
}

// ─── Loading skeleton ────────────────────────────────────────────────────────
// Mirrors the populated layout so the chrome doesn't jump on swap-in: a
// skeleton tab strip, a skeleton toolbar row, then two buckets with placeholder
// card grids. Quiet pulse — no shimmer sweep — to stay on-brand with the rest
// of the editorial GRC surfaces.

function CatalogLoadingSkeleton() {
  // Vary the card widths slightly so the grid doesn't read as a single flat
  // block of beige. Same number of skeletons per row as the real grid.
  const bucketSizes = [6, 3];
  return (
    <div className="space-y-5 animate-pulse">
      {/* Skeleton tab strip */}
      <div className="border-b border-canvas-border -mx-1">
        <div className="flex items-center gap-1 px-1">
          {[0, 1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="flex items-center gap-2 px-3.5 h-10">
              <div className="w-3 h-3 rounded bg-paper-100" />
              <div className="h-3 rounded bg-paper-100" style={{ width: 56 + (i % 3) * 14 }} />
              <div className="w-6 h-4 rounded-full bg-paper-100" />
            </div>
          ))}
        </div>
      </div>

      {/* Skeleton toolbar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 max-w-xl h-9 rounded-lg bg-paper-100" />
        <div className="w-24 h-9 rounded-lg bg-paper-100" />
        <div className="w-[4.25rem] h-9 rounded-lg bg-paper-100" />
        <div className="w-20 h-9 rounded-lg bg-paper-100" />
        <div className="w-28 h-9 rounded-lg bg-brand-100" />
      </div>

      {/* Skeleton buckets */}
      {bucketSizes.map((n, bi) => (
        <div key={bi}>
          <div className="h-3 w-32 rounded bg-paper-100 mb-3" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: n }).map((_, i) => (
              <div
                key={i}
                className="flex items-start gap-3 px-4 py-3.5 rounded-lg bg-canvas-elevated border border-canvas-border"
              >
                <div className="w-10 h-10 rounded-lg bg-paper-100 shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-3 rounded bg-paper-100" style={{ width: `${55 + ((i * 7) % 30)}%` }} />
                  <div className="h-2.5 rounded bg-paper-100" style={{ width: `${30 + ((i * 11) % 20)}%` }} />
                  <div className="h-2 rounded bg-paper-100 mt-3" style={{ width: `${45 + ((i * 5) % 25)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── DataSourcesView ─────────────────────────────────────────────────────────


export interface DataSourcesViewHandle {
  /** Opens the Add-source picker modal. Used by the persistent header CTA. */
  openPicker: () => void;
  /** Opens the side panel for a specific source id. Reserved for future deep-
   *  link callers (e.g. notification → "review this source"). */
  focusSource: (id: string) => void;
}

export type DisplayMode = 'empty' | 'loading' | 'loaded';

interface DataSourcesViewProps {
  /** Fired whenever the source list changes — lets the parent (KnowledgeHubView)
   *  render header stats like totals, indexed bytes, last added. */
  onStatsChange?: (stats: HubStats) => void;
  /** Demo-state override. 'empty' forces the welcome card, 'loading' renders
   *  the skeleton, 'loaded' (default) uses the real source list. */
  displayMode?: DisplayMode;
}

const DataSourcesView = forwardRef<DataSourcesViewHandle, DataSourcesViewProps>(function DataSourcesView({ onStatsChange, displayMode = 'loaded' }, ref) {
  const { addToast } = useToast();
  const prefersReducedMotion = useReducedMotion();
  const [tab, setTab] = useState<TabId>('all');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>(DEFAULT_DATE_FILTER);
  const [dateOpen, setDateOpen] = useState(false);
  const [activeSource, setActiveSource] = useState<DataSource | null>(null);
  // Side-panel a11y refs: container we focus on open, and the element to
  // restore focus to on close (typically the source row that was clicked).
  const returnFocusRef = useRef<HTMLElement | null>(null);
  // When the menu's Rename is clicked, we set this so the detail view enters
  // rename mode immediately on mount. Cleared after the detail view consumes it.
  const [pendingRename, setPendingRename] = useState(false);
  // Source list comes from the swappable data hook. Today the hook is backed
  // by localStorage; when a real backend ships we replace the hook body and
  // nothing in this file changes. See src/hooks/useKnowledgeSources.ts.
  const knowledge = useKnowledgeSources();
  const sources = knowledge.sources;
  // Keep a live ref to the latest list so the imperative handle's focusSource
  // closure always sees fresh data without forcing the handle to re-create.
  const sourcesRef = useRef<DataSource[]>(sources);
  useEffect(() => { sourcesRef.current = sources; }, [sources]);
  // Single unified picker — same multi-tab UX as the chat composer's Add data.
  // The picker is locked to the Upload tab in kh-add mode (DB connect is a
  // backend-dependent flow; see DataPickerModal's KH_ADD_TABS comment).
  const [pickerOpen, setPickerOpen] = useState(false);
  useImperativeHandle(ref, () => ({
    openPicker: () => setPickerOpen(true),
    focusSource: (id: string) => {
      const match = sourcesRef.current.find(s => s.id === id);
      if (match) setActiveSource(match);
    },
  }), []);
  // Selection state. Mode is derived: any time at least one source is
  // selected, the UI treats the surface as "in selection mode" — checkboxes
  // become persistent on every card and the bulk bar surfaces. There's no
  // separate `selectMode` flag because hover-to-reveal handles the entry.
  // lastSelectedId is the anchor for Shift+Click range selection.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const isSelecting = selectedIds.size > 0;
  // Page-size limit applied to the flat (pre-bucket) visible list. "Load more
  // data" expands by another PAGE_SIZE; resets to PAGE_SIZE on tab/search/date
  // changes so users don't carry a deep scroll into a fresh slice.
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  // View mode — grid (rich tiles) vs list (dense rows). Persisted to localStorage.
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'grid';
    const stored = window.localStorage.getItem('kh:viewMode');
    return stored === 'list' ? 'list' : 'grid';
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('kh:viewMode', viewMode);
  }, [viewMode]);

  // ── In-page detail a11y ─────────────────────────────────────────────────────
  // The source detail is now a same-page view (not an overlay drawer), so there
  // is no body-scroll lock or focus trap. We still (1) close on Escape and
  // (2) restore focus to the row that opened it when returning to the list.
  useEffect(() => {
    if (!activeSource) return;

    returnFocusRef.current = document.activeElement as HTMLElement | null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setActiveSource(null);
        setPendingRename(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      // Restore focus to the row that opened the detail (or wherever focus was).
      returnFocusRef.current?.focus?.();
      returnFocusRef.current = null;
    };
  }, [activeSource]);

  // First-run hint: tracks transition from 0 → 1 source to fire the @-mention nudge once.
  const prevSourcesLenRef = useRef<number>(sources.length);

  // Predicate fn per tab — single source of truth for counts + visibility.
  const tabPredicate = (id: TabId) => (d: DataSource): boolean => {
    if (id === 'all')        return true;
    if (id === 'file')       return d.type === 'file' && !d.isFolder;
    if (id === 'folder')     return d.type === 'file' && d.isFolder === true;
    if (id === 'integrated') return INTEGRATED_TYPES.includes(d.type);
    return false;
  };

  const tabCounts = useMemo<Record<TabId, number>>(() => ({
    all:        sources.length,
    file:       sources.filter(tabPredicate('file')).length,
    folder:     sources.filter(tabPredicate('folder')).length,
    integrated: sources.filter(tabPredicate('integrated')).length,
  }), [sources]);

  // Total count within the active tab — used to show "X of N" when filtered.
  const tabTotal = useMemo(() => sources.filter(tabPredicate(tab)).length, [sources, tab]);

  const visible = useMemo(() => {
    return sources
      .filter(tabPredicate(tab))
      .filter(d => !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.subtype.toLowerCase().includes(search.toLowerCase()))
      .filter(d => dateInFilter(d.createdAt, dateFilter, TODAY))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [sources, tab, search, dateFilter]);

  // ── Stats publication ──────────────────────────────────────────────────────
  // Aggregate live whenever the source list changes; fire onStatsChange so the
  // page header (in KnowledgeHubView) reflects the current catalog. In demo
  // override modes, surface zero stats so the pinned card and other stat-
  // dependent surfaces don't leak populated-state data.
  useEffect(() => {
    if (!onStatsChange) return;
    if (displayMode !== 'loaded') {
      onStatsChange({
        total: 0, files: 0, folders: 0, integrations: 0, totalBytes: 0,
        attentionCount: 0, connectedTypes: [],
        typeBreakdown: {}, recentSources: [],
        backend: knowledge.backend,
      });
      return;
    }
    const total = sources.length;
    const files = sources.filter(s => s.type === 'file' && !s.isFolder).length;
    const folders = sources.filter(s => s.type === 'file' && s.isFolder === true).length;
    const integrations = sources.filter(s => INTEGRATED_TYPES.includes(s.type)).length;
    const totalBytes = sources.reduce((sum, s) => sum + parseSizeBytes(s.subtype), 0);
    const lastAdded = sources
      .map(s => s.createdAt)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
    const degraded = sources.filter(s => INTEGRATED_TYPES.includes(s.type) && integrationHealth(s) === 'degraded');
    const connectedTypes = Array.from(new Set(sources.map(s => s.type)));
    // Per-type counts. Folders are counted separately on HubStats; for the
    // breakdown card we count files (non-folder) vs folder cards under
    // 'file' too — UX treats both as "file sources".
    const typeBreakdown = sources.reduce<Partial<Record<SourceType, number>>>((acc, s) => {
      acc[s.type] = (acc[s.type] ?? 0) + 1;
      return acc;
    }, {});
    // Last 3 by createdAt, newest first. Powers the "Recently added" card.
    const recentSources = [...sources]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
    onStatsChange({
      total, files, folders, integrations, totalBytes, lastAdded,
      attentionCount: degraded.length,
      firstAttentionId:   degraded[0]?.id,
      firstAttentionName: degraded[0]?.name,
      connectedTypes,
      typeBreakdown,
      recentSources,
      backend: knowledge.backend,
    });
  }, [sources, onStatsChange, displayMode, knowledge.backend]);

  const dateActive = isDateFilterActive(dateFilter);
  const isFiltered = search.trim() !== '' || dateActive;
  const dateLabel = dateFilterLabel(dateFilter);
  const clearAllFilters = () => { setSearch(''); setDateFilter(DEFAULT_DATE_FILTER); };

  const renameSource = (id: string, newName: string) => {
    knowledge.rename(id, newName);
    setActiveSource(curr => curr && curr.id === id ? { ...curr, name: newName } : curr);
  };

  // ── Destructive-action confirmation ──────────────────────────────────────
  // Holds the snapshots queued for removal. Render is gated on this being
  // non-null; ConfirmationModal at the bottom of the tree consumes it.
  const [pendingRemove, setPendingRemove] = useState<DataSource[] | null>(null);

  // Single-source path: SourceCard's menu Remove/Disconnect calls this. We
  // look up the snapshot from current state and queue it for confirmation.
  const requestRemove = (id: string) => {
    const snap = sources.find(s => s.id === id);
    if (snap) setPendingRemove([snap]);
  };

  // Bulk path: bulk action bar's Disconnect/Remove button calls this. All
  // currently-selected sources get queued atomically.
  const requestBulkRemove = () => {
    const snapshots = sources.filter(s => selectedIds.has(s.id));
    if (snapshots.length === 0) { clearSelection(); return; }
    setPendingRemove(snapshots);
  };

  // Bulk path: bulk action bar's "Add to chat" button. Placeholder action —
  // surfaces a toast confirming the intent; the actual chat-attach flow lives
  // in the chat composer's @-mention model and will be wired once the back-
  // end-attach API exists.
  const addSelectedToChat = () => {
    const n = selectedIds.size;
    if (n === 0) return;
    addToast({
      type: 'success',
      message: `Started a new chat with ${n} ${n === 1 ? 'source' : 'sources'} attached.`,
    });
    clearSelection();
  };

  // Confirmed: actually remove + show toast with Undo so a misclick on the
  // confirm button is still recoverable. The hook's addMany dedupes by id so
  // Undo is safe to fire even if the user re-added a same-id source manually.
  const confirmRemove = () => {
    if (!pendingRemove) return;
    const snapshots = pendingRemove;
    knowledge.removeMany(snapshots.map(s => s.id));
    const allIntegrated = snapshots.every(s => INTEGRATED_TYPES.includes(s.type));
    const verb = allIntegrated ? 'Disconnected' : 'Removed';
    const target = snapshots.length === 1
      ? `"${snapshots[0].name}"`
      : `${snapshots.length} ${snapshots.length === 1 ? 'source' : 'sources'}`;
    addToast({
      type: 'info',
      message: `${verb} ${target}.`,
      action: { label: 'Undo', onClick: () => knowledge.addMany(snapshots) },
    });
    setPendingRemove(null);
    clearSelection();
  };

  // Toggle a single source. With `shift`, extend the range from the last
  // selected id through this one (in the rendered/visible order). Without
  // `shift`, behave as a normal toggle and update the range anchor.
  const toggleSelect = (id: string, opts?: { shift?: boolean }) => {
    if (opts?.shift && lastSelectedId && lastSelectedId !== id) {
      const order = paginatedVisible.map(s => s.id);
      const i1 = order.indexOf(lastSelectedId);
      const i2 = order.indexOf(id);
      if (i1 >= 0 && i2 >= 0) {
        const [lo, hi] = i1 < i2 ? [i1, i2] : [i2, i1];
        setSelectedIds(prev => {
          const next = new Set(prev);
          for (let i = lo; i <= hi; i++) next.add(order[i]);
          return next;
        });
        // Anchor stays at the original lastSelectedId so a follow-up shift
        // can extend further from the same start point.
        return;
      }
    }
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setLastSelectedId(id);
  };

  // Per-bucket "Select all" — flip every item in the bucket on if any is
  // unselected; otherwise clear them all.
  const toggleBucketSelect = (items: DataSource[]) => {
    const allIn = items.every(d => selectedIds.has(d.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allIn) items.forEach(d => next.delete(d.id));
      else items.forEach(d => next.add(d.id));
      return next;
    });
    if (!allIn && items.length > 0) setLastSelectedId(items[items.length - 1].id);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setLastSelectedId(null);
  };

  // Reset search + date filter on tab switch so each tab opens "fresh". Avoids
  // confusion when the user toggles tabs and sees an unexplained empty state.
  useEffect(() => {
    setSearch('');
    setDateFilter(DEFAULT_DATE_FILTER);
    setVisibleLimit(PAGE_SIZE);
    // Clearing selection on tab change keeps the bulk bar coherent with what's visible.
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Esc clears the current selection — the conventional way out of selection
  // mode when there's no explicit "Done" button. Skipped while the source
  // detail panel is open (Esc there belongs to the panel's own dismiss).
  useEffect(() => {
    if (!isSelecting || activeSource) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearSelection();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelecting, activeSource]);

  // Reset Load-more pagination whenever the filter set changes — otherwise a
  // user who paged deep, then typed in the search, would see a smaller set
  // still capped at the previous expanded limit (no visual problem, just
  // confusing when "Load more" appears for a narrow result).
  useEffect(() => {
    setVisibleLimit(PAGE_SIZE);
  }, [search, dateFilter]);

  // First-run hint: when sources transitions from 0 → 1, nudge with the @-mention pattern.
  useEffect(() => {
    if (prevSourcesLenRef.current === 0 && sources.length === 1) {
      addToast({
        type: 'info',
        message: `Reference it in chat with @${sources[0].name}.`,
      });
    }
    prevSourcesLenRef.current = sources.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources.length]);


  // Keep selectedIds + range anchor in sync with the actual source list —
  // drop ids for sources that have been removed (undo-rollback, deletion).
  useEffect(() => {
    const ids = new Set(sources.map(s => s.id));
    if (lastSelectedId && !ids.has(lastSelectedId)) setLastSelectedId(null);
    if (selectedIds.size === 0) return;
    let changed = false;
    const next = new Set<string>();
    selectedIds.forEach(id => { if (ids.has(id)) next.add(id); else changed = true; });
    if (changed) setSelectedIds(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources]);

  const handlePickerConfirm = async (selections: AttachmentSelection[]) => {
    const uploads   = selections.filter((s): s is Extract<AttachmentSelection, { kind: 'upload' }>     => s.kind === 'upload');
    const dbConnect = selections.filter((s): s is Extract<AttachmentSelection, { kind: 'connect-db' }> => s.kind === 'connect-db');

    // Per-file row/page metadata. With real bytes we parse the true count —
    // PDFs via pdf.js (page count), CSV/XLSX via SheetJS (data-row count) — so
    // the header count matches the live preview. Byte-less files (or parse
    // failures) fall back to the size-based estimate.
    const fileMeta = async (name: string, sizeBytes: number, real?: File) => {
      const fmt = fileFormat(name);
      if (real) {
        if (fmt === 'PDF') {
          const pages = await countPdfPages(real);
          if (pages != null) return { pages };
        } else if (fmt === 'CSV' || fmt === 'XLSX') {
          const rows = await countSheetRows(real);
          if (rows != null) return { rows };
        }
      }
      return metaForFormat(fmt, sizeBytes);
    };

    // Split uploads into folder groups (one source per folder) vs loose files
    // (one source per file). Files in the same root folder become the contents
    // of that folder's source via DATASET_FILES.
    const folders = new Map<string, typeof uploads>();
    const loose:   typeof uploads = [];
    for (const u of uploads) {
      const root = rootFolder(u.path, u.name);
      if (root) {
        const arr = folders.get(root) ?? [];
        arr.push(u);
        folders.set(root, arr);
      } else {
        loose.push(u);
      }
    }
    const folderCount = folders.size;
    const looseCount  = loose.length;
    const totalFiles  = uploads.length;

    if (uploads.length > 0 || dbConnect.length > 0) {
      const taken = new Set(sources.map(s => s.name));
      // Anchor newly-added sources to the app's reference "today" (TODAY), not
      // the machine clock — the whole view buckets and filters against TODAY,
      // so a real-clock timestamp would land uploads in "Last 7 days". Use
      // TODAY noon + 1min so they sit just above the seed's newest item and top
      // the Today bucket.
      const nowIso = new Date(TODAY.getTime() + 12 * 60 * 60 * 1000 + 60 * 1000).toISOString();
      const today  = nowIso.slice(0, 10);

      // ── Loose-file sources: one card per file ────────────────────────
      // Reserve deduped names synchronously first (keeps ordering stable), then
      // parse counts in parallel.
      const looseReserved = loose.map(u => {
        const finalName = dedupeName(u.name, taken);
        taken.add(finalName);
        return { u, finalName };
      });
      const looseAdds: DataSource[] = await Promise.all(looseReserved.map(async ({ u, finalName }) => {
        const sourceId = `upl-${u.localId}`;
        const fileId = `${sourceId}-1`;
        // Persist single-file content for the detail view.
        setSourceFiles(sourceId, [{
          id:         fileId,
          name:       u.name,
          format:     fileFormat(u.name),
          sizeBytes:  u.sizeBytes,
          uploadedAt: today,
          status:     'processed',
          ...(await fileMeta(u.name, u.sizeBytes, u.file)),
        }]);
        // Keep the real bytes for an in-session preview (PDF iframe, etc.).
        if (u.file) registerFileBlob(fileId, u.file);
        return {
          id:        sourceId,
          name:      finalName,
          type:      'file' as SourceType,
          subtype:   `${formatExt(finalName)} · ${formatBytesShort(u.sizeBytes)}`,
          createdAt: nowIso,
        };
      }));

      // ── Folder sources: one card per folder, files inside ────────────
      const folderAdds: DataSource[] = [];
      for (const [folderName, files] of folders) {
        const finalName = dedupeName(folderName, taken);
        taken.add(finalName);
        const sourceId  = `upl-folder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const totalSize = files.reduce((sum, f) => sum + f.sizeBytes, 0);
        // Persist folder contents — strip the root folder prefix so display is "Q1/sales.csv".
        const fileEntries = await Promise.all(files.map(async (f, i) => {
          const fileId = `${sourceId}-${i + 1}`;
          if (f.file) registerFileBlob(fileId, f.file);
          return {
            id:         fileId,
            name:       f.path ? f.path.replace(`${folderName}/`, '') : f.name,
            format:     fileFormat(f.name),
            sizeBytes:  f.sizeBytes,
            uploadedAt: today,
            status:     'processed' as const,
            ...(await fileMeta(f.name, f.sizeBytes, f.file)),
          };
        }));
        setSourceFiles(sourceId, fileEntries);
        folderAdds.push({
          id:        sourceId,
          name:      finalName,
          type:      'file' as SourceType,
          isFolder:  true,
          subtype:   `Folder · ${files.length} ${files.length === 1 ? 'file' : 'files'} · ${formatBytesShort(totalSize)}`,
          createdAt: nowIso,
        });
      }

      // ── DB sources ───────────────────────────────────────────────────
      const dbAdds: DataSource[] = dbConnect.map(d => {
        const finalName = dedupeName(d.name, taken);
        taken.add(finalName);
        return {
          id:        `db-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name:      finalName,
          type:      'database' as SourceType,
          subtype:   `${d.dbType} · ${d.database}`,
          createdAt: nowIso,
        };
      });

      knowledge.addMany([...folderAdds, ...looseAdds, ...dbAdds]);
    }

    // Toast wording reflects what actually happened.
    if (dbConnect.length > 0) {
      addToast({ type: 'success', message: `Connected to ${dbConnect[0].name}` });
    } else if (uploads.length > 0) {
      const parts: string[] = [];
      if (folderCount > 0) parts.push(`${folderCount} ${folderCount === 1 ? 'folder' : 'folders'} (${totalFiles - looseCount} files)`);
      if (looseCount > 0)  parts.push(`${looseCount} ${looseCount === 1 ? 'file' : 'files'}`);
      addToast({ type: 'success', message: `Added ${parts.join(' · ')} to Knowledge Hub.` });
    }

    setPickerOpen(false);
  };

  // Always group by relative-date buckets (Today / Last 7 days / Earlier).
  // Sort is implicit: newest-first within and across buckets.
  const paginatedVisible = useMemo(() => visible.slice(0, visibleLimit), [visible, visibleLimit]);
  const buckets = bucketByDate(paginatedVisible);
  const hasMore = visible.length > visibleLimit;

  // ── Demo override: loading skeleton ──────────────────────────────────────
  if (displayMode === 'loading') {
    return <CatalogLoadingSkeleton />;
  }

  // ── True-empty state ─────────────────────────────────────────────────────
  // Editorial centered card with a clearly visible dashed brand-tinted border.
  // Stronger contrast against the lavender page bg so the container reads as
  // a distinct surface, not a faded smudge.
  if (displayMode === 'empty' || sources.length === 0) {
    return (
      <>
        <div className="rounded-lg border-2 border-dashed border-brand-100 bg-canvas-elevated/95 shadow-[0_1px_3px_rgb(15_8_30_/_0.03)]">
          <div className="flex flex-col items-center justify-center text-center py-24 px-8">
            <div className="w-14 h-14 rounded-lg border border-paper-200 bg-paper-0 flex items-center justify-center mb-6">
              <Layers size={24} className="text-ink-400" strokeWidth={1.4} />
            </div>
            <h2 className="font-display text-[1.375rem] font-[420] text-ink-900 leading-tight">
              Your Knowledge Hub is empty
            </h2>
            <p className="text-[0.9375rem] text-ink-500 mt-3 max-w-xl leading-relaxed">
              Files, databases, and cloud sources you add here become available across the platform —
              chats, dashboards, and workflows all read from the same catalog.
            </p>
            <div className="mt-7">
              <Button
                variant="primary"
                leftIcon={<Plus size={14} />}
                onClick={() => setPickerOpen(true)}
              >
                Add your first source
              </Button>
            </div>
            <p className="text-[0.75rem] text-ink-400 mt-7">
              Supports PDF <span className="text-ink-300">·</span> CSV <span className="text-ink-300">·</span> XLSX.
            </p>
          </div>
        </div>

        <DataPickerModal
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onConfirm={handlePickerConfirm}
          title="Add data source"
          confirmLabel="Add"
          mode="kh-add"
        />
      </>
    );
  }

  // ── Source detail — same-page view ──
  // Clicking a source swaps the list for its detail on this page (no overlay
  // drawer). The detail's own breadcrumb / back button returns to the list.
  if (activeSource) {
    return (
      <DataSourceDetailView
        source={activeSource}
        onBack={() => { setActiveSource(null); setPendingRename(false); }}
        onRename={(newName) => renameSource(activeSource.id, newName)}
        startRenaming={pendingRename}
        onStartRenamingConsumed={() => setPendingRename(false)}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Storage-failure banner — surfaced when the localStorage mirror fails
          (typically quota exceeded). The error clears automatically on the
          next successful save, so the banner is self-dismissing. */}
      {knowledge.error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-risk-200 bg-risk-50 px-3.5 py-3 text-risk-700">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div className="min-w-0 text-[0.8125rem] leading-relaxed">
            <span className="font-semibold">Couldn’t save to this browser.</span>{' '}
            Storage may be full — recent changes won’t persist after a reload. Remove some sources to free space.
          </div>
        </div>
      )}
      {/* ── Top row: filter pills LEFT + primary CTA RIGHT. Pill + CTA styles
          mirror the platform pattern (see AutomationPortfolioView /
          EngagementLibraryView) so the page reads as native rather than
          a one-off. */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="inline-flex items-center gap-1 p-1.5 rounded-lg border border-canvas-border/60 bg-canvas-elevated/40 w-fit max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map(t => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            const count = tabCounts[t.id];
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`shrink-0 relative inline-flex items-center gap-2.5 px-3.5 h-9 rounded-lg text-[0.875rem] transition-colors cursor-pointer ${
                  isActive
                    ? 'text-brand-700 font-semibold'
                    : 'text-ink-500 font-medium hover:text-ink-800'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="kh-filter-pill-bg"
                    className="absolute inset-0 bg-canvas-elevated rounded-lg shadow-[0_1px_2px_rgb(15_8_30_/_0.06),0_2px_6px_rgb(15_8_30_/_0.04)] border border-canvas-border"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Icon size={15} className={isActive ? 'text-brand-600' : 'text-ink-400'} />
                  <span>{t.label}</span>
                  <span className={`tabular-nums font-bold text-[0.8125rem] ${
                    isActive ? 'text-brand-700' : 'text-ink-400'
                  }`}>
                    {count}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {/* Primary CTA — matches the DashboardListPage "Create Dashboard"
            button: solid brand-600, no gradient, simple color-shift hover. */}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="shrink-0 flex items-center gap-2 px-4 h-10 bg-brand-600 hover:bg-brand-500 active:bg-brand-800 text-white rounded-md text-[0.8125rem] font-semibold transition-colors cursor-pointer"
        >
          <Plus size={14} />
          Add source
        </button>
      </div>

      {/* ── Toolbar — search + "All time" picker. Field styles mirror the
          DashboardListPage search exactly (rounded-md, bg-canvas-elevated,
          py-2, ink-800 text, brand-300 focus border) so the page sits in
          the same visual family. */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[14rem]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
          <input
            type="text"
            placeholder={`Search ${tab === 'all' ? 'all sources' : TABS.find(t => t.id === tab)!.label.toLowerCase()}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="no-focus-ring w-full pl-9 pr-9 h-[38px] border border-canvas-border rounded-lg text-[0.8125rem] text-ink-800 placeholder:text-ink-400 bg-canvas-elevated focus:outline-none focus:border-brand-300 transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-ink-400 hover:text-ink-700 hover:bg-paper-100 cursor-pointer"
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* View toggle — same sliding-white-pill segmented control as the
            filter tabs above (motion layoutId), so the two segmented controls
            on the page read as one family. The active icon carries the brand
            colour; the pill itself stays neutral white. */}
        <div className="inline-flex items-center gap-1 px-1 h-[38px] rounded-lg border border-canvas-border/60 bg-canvas-elevated/40">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className="relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors cursor-pointer"
            aria-label="Grid view"
            aria-pressed={viewMode === 'grid'}
            title="Grid view"
          >
            {viewMode === 'grid' && (
              <motion.div
                layoutId="kh-viewmode-pill"
                className="absolute inset-0 bg-canvas-elevated rounded-lg shadow-[0_1px_2px_rgb(15_8_30_/_0.06),0_2px_6px_rgb(15_8_30_/_0.04)] border border-canvas-border"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <LayoutGrid size={15} className={`relative z-10 transition-colors ${viewMode === 'grid' ? 'text-brand-700' : 'text-ink-500'}`} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className="relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors cursor-pointer"
            aria-label="List view"
            aria-pressed={viewMode === 'list'}
            title="List view"
          >
            {viewMode === 'list' && (
              <motion.div
                layoutId="kh-viewmode-pill"
                className="absolute inset-0 bg-canvas-elevated rounded-lg shadow-[0_1px_2px_rgb(15_8_30_/_0.06),0_2px_6px_rgb(15_8_30_/_0.04)] border border-canvas-border"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <Rows3 size={15} className={`relative z-10 transition-colors ${viewMode === 'list' ? 'text-brand-700' : 'text-ink-500'}`} />
          </button>
        </div>

        <DateFilterPicker
          filter={dateFilter}
          open={dateOpen}
          onToggle={() => setDateOpen(p => !p)}
          onClose={() => setDateOpen(false)}
          onApply={(next) => { setDateFilter(next); setDateOpen(false); }}
          today={TODAY}
          triggerRounded="rounded-lg"
          triggerHeight="h-[38px]"
        />
      </div>

      {/* ── Active filter chips — single inline strip when filters are on ── */}
      {isFiltered && (
        <div className="flex items-center gap-2 flex-wrap -mt-1">
          <span className="text-[0.75rem] text-ink-500 tabular-nums">
            <span className="font-semibold text-ink-800">{visible.length}</span> of {tabTotal} {tabTotal === 1 ? 'source' : 'sources'}
          </span>
          {search.trim() && (
            <FilterChip
              label={<>Search: <span className="font-semibold">"{search.trim()}"</span></>}
              onClear={() => setSearch('')}
            />
          )}
          {dateActive && (
            <FilterChip
              label={<>Date: <span className="font-semibold">{dateLabel}</span></>}
              onClear={() => setDateFilter(DEFAULT_DATE_FILTER)}
            />
          )}
          <button
            onClick={clearAllFilters}
            className="text-[0.75rem] font-medium text-brand-700 hover:text-brand-800 hover:underline cursor-pointer ml-1"
          >
            Clear all
          </button>
        </div>
      )}

      {/* ── Body ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab + (search ? '+s' : '') + (dateActive ? '+d' : '')}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
          className="space-y-6"
        >
          {visible.length === 0 && (
            <PerTabEmptyState
              isFiltered={isFiltered}
              tab={tab}
              search={search}
              dateActive={dateActive}
              dateLabel={dateLabel}
              onOpenPicker={() => setPickerOpen(true)}
              onRequestIntegration={() => addToast({ type: 'info', message: 'Opening email…' })}
            />
          )}

          {buckets.map(b => {
            const allInBucket = b.items.length > 0 && b.items.every(d => selectedIds.has(d.id));
            const anyInBucket = b.items.some(d => selectedIds.has(d.id));
            return (
            <div key={b.id} className="group/bucket">
              {/* Bucket header — label + count on left, per-bucket Select all
                  link on right. The link surfaces persistently while selecting,
                  and on hover otherwise. Toggles between "Select all" and
                  "Clear" depending on bucket state. */}
              <div className="flex items-center justify-between mb-4">
                <div className="text-[0.875rem] font-medium text-ink-800 tabular-nums">
                  {b.label}
                  <span className="text-ink-400 ml-1.5">· {b.items.length}</span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleBucketSelect(b.items)}
                  className={`text-[0.75rem] font-semibold text-brand-700 hover:text-brand-800 hover:underline cursor-pointer transition-opacity ${
                    isSelecting ? 'opacity-100' : 'opacity-0 group-hover/bucket:opacity-100 focus-visible:opacity-100'
                  }`}
                  aria-label={allInBucket ? `Clear selection in ${b.label}` : `Select all in ${b.label}`}
                >
                  {allInBucket ? 'Clear' : anyInBucket ? 'Select all' : 'Select all'}
                </button>
              </div>
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {b.items.map((d, idx) => (
                    <motion.div
                      key={d.id}
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: Math.min(idx, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <SourceCard
                        source={d}
                        viewMode="grid"
                        onOpen={() => setActiveSource(d)}
                        onRemove={requestRemove}
                        onRename={renameSource}
                        isSelecting={isSelecting}
                        selected={selectedIds.has(d.id)}
                        onToggleSelect={toggleSelect}
                      />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-canvas-border bg-canvas-elevated overflow-hidden divide-y divide-canvas-border">
                  {b.items.map((d, idx) => (
                    <motion.div
                      key={d.id}
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28, delay: Math.min(idx, 8) * 0.03, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <SourceCard
                        source={d}
                        viewMode="list"
                        onOpen={() => setActiveSource(d)}
                        onRemove={requestRemove}
                        onRename={renameSource}
                        isSelecting={isSelecting}
                        selected={selectedIds.has(d.id)}
                        onToggleSelect={toggleSelect}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* ── Result count + "Load more data". Centered below the grid. The
          count reflects what's actually rendered ("9 of 1602") so users know
          there's more to fetch — and the button reveals the next page. */}
      {visible.length > 0 && (
        <div className="flex flex-col items-center gap-4 pt-2">
          <div className="text-[0.8125rem] text-ink-500 tabular-nums">
            Showing <span className="font-semibold text-ink-700">{paginatedVisible.length}</span> of <span className="font-semibold text-ink-700">{visible.length}</span> {visible.length === 1 ? 'source' : 'sources'}
          </div>
          {hasMore && (
            <button
              type="button"
              onClick={() => setVisibleLimit(l => l + PAGE_SIZE)}
              className="inline-flex items-center px-6 h-11 rounded-lg bg-canvas-elevated border border-canvas-border text-[0.875rem] font-semibold text-ink-800 hover:bg-paper-50 hover:border-ink-300 transition-colors cursor-pointer"
            >
              Load more data
            </button>
          )}
        </div>
      )}

      {/* ── Shared add-data picker — Upload-only in kh-add mode today. ── */}
      <DataPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={handlePickerConfirm}
        title="Add data source"
        confirmLabel="Add"
        mode="kh-add"
      />

      {/* ── Sticky bulk action bar ──
          Surfaces whenever the user has anything selected. Three actions
          today: Add to chat (works for any source), Remove or Disconnect
          (verb adapts to whether every selected source is an integration),
          and a quiet Cancel/×. */}
      <AnimatePresence>
        {isSelecting && (() => {
          const selected = sources.filter(s => selectedIds.has(s.id));
          const allIntegrated = selected.length > 0 && selected.every(s => INTEGRATED_TYPES.includes(s.type));
          return (
            <motion.div
              key="bulk-bar"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
              role="toolbar"
              aria-label="Bulk actions for selected sources"
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 pl-4 pr-2 py-2 rounded-lg bg-ink-900 text-paper-0 shadow-[0_8px_28px_rgb(15_8_30_/_0.28)] ring-1 ring-ink-800/60"
            >
              <span className="text-[0.8125rem] font-semibold tabular-nums">
                {selectedIds.size} selected
              </span>
              <div className="w-px h-5 bg-ink-700/60 mx-1" aria-hidden />
              <button
                type="button"
                onClick={addSelectedToChat}
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-[0.8125rem] font-medium text-paper-0/90 hover:text-paper-0 hover:bg-ink-800 cursor-pointer transition-colors"
              >
                <MessageSquare size={14} />
                Add to chat
              </button>
              <button
                type="button"
                onClick={requestBulkRemove}
                className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-[0.8125rem] font-medium cursor-pointer transition-colors ${
                  allIntegrated
                    ? 'text-paper-0/90 hover:text-paper-0 hover:bg-ink-800'
                    : 'text-risk-300 hover:text-paper-0 hover:bg-risk-700'
                }`}
              >
                {allIntegrated ? <Unplug size={14} /> : <Trash2 size={14} />}
                {allIntegrated ? 'Disconnect' : 'Remove'}
              </button>
              <div className="w-px h-5 bg-ink-700/60 mx-1" aria-hidden />
              <button
                type="button"
                onClick={clearSelection}
                aria-label="Cancel selection"
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-paper-0/70 hover:text-paper-0 hover:bg-ink-800 cursor-pointer transition-colors"
              >
                <X size={15} />
              </button>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ── Destructive-action confirmation ──
          Surfaced for both single-source menu Remove/Disconnect AND bulk
          action bar Disconnect. Wording switches verb (Disconnect vs Remove)
          based on whether every queued source is an integration. */}
      {(() => {
        const queued = pendingRemove ?? [];
        const allIntegrated = queued.length > 0 && queued.every(s => INTEGRATED_TYPES.includes(s.type));
        const verb = allIntegrated ? 'Disconnect' : 'Remove';
        const name = queued.length === 1
          ? `"${queued[0].name}"`
          : `${queued.length} ${queued.length === 1 ? 'source' : 'sources'}`;
        return (
          <ConfirmationModal
            open={!!pendingRemove}
            title={`${verb} ${name}?`}
            description={
              allIntegrated
                ? <>The connection settings are kept, but IRA can't read from {queued.length === 1 ? 'this source' : 'these sources'} until you re-connect. You can undo this from the toast that appears next.</>
                : <>{queued.length === 1 ? 'This file is' : 'These files are'} removed from your Knowledge Hub. You can undo this from the toast that appears next.</>
            }
            confirmLabel={verb}
            tone="destructive"
            onConfirm={confirmRemove}
            onClose={() => setPendingRemove(null)}
          />
        );
      })()}
    </div>
  );
});

export default DataSourcesView;
