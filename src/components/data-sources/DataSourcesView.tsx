import { useState, useMemo, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Database, FileText, Layers, FolderOpen,
  Search, Upload, MoreHorizontal, Plus, X,
  Pencil, Trash2, Unplug, Check, CheckSquare,
  Globe, Cloud, MessageSquare,
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
import {
  TODAY, INTEGRATED_TYPES, TYPE_META, formatDate, SEED,
  type DataSource, type SourceType,
} from './sources';
import { DATASET_FILES, type FileFormat } from './datasetFiles';

// Mutable copy — supports inline rename without forcing a parent-level state lift.
let SOURCES_STATE: DataSource[] | null = null;

// First-render seed for the Knowledge Hub grid. Set to `[]` so the empty-state
// welcome is visible on a fresh load. Flip to `SEED` (imported from ./sources)
// to restore the 24 demo sources for screenshots / sales demos. Single-line
// toggle on purpose — no env var, no flag, just edit this one constant.
const INITIAL_SOURCES: DataSource[] = SEED;

// ─── Upload helpers ──────────────────────────────────────────────────────────

const KB = 1024;
const MB = KB * 1024;
function formatBytesShort(bytes: number): string {
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
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

type TabId = 'all' | 'file' | 'folder' | 'database' | 'api' | 'cloud' | 'session';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'all',      label: 'All',          icon: Layers },
  { id: 'file',     label: 'Files',        icon: FileText },
  { id: 'folder',   label: 'Folders',      icon: FolderOpen },
  { id: 'database', label: 'Databases',    icon: Database },
  { id: 'api',      label: 'APIs',         icon: Globe },
  { id: 'cloud',    label: 'Cloud',        icon: Cloud },
  { id: 'session',  label: 'Sessions',     icon: MessageSquare },
];

type ViewMode = 'grid' | 'list';

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
function integrationHealth(id: string): 'healthy' | 'degraded' {
  let h = 0;
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
  onRemove: (id: string) => void;
  onRestore: (snapshot: DataSource) => void;
  onRenameInDetail: () => void;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  viewMode: ViewMode;
}

// Shared remove + click handlers — used by both card and row renderers.
function useCardActions(source: DataSource, onOpen: () => void, onRemove: (id: string) => void, onRestore: (snapshot: DataSource) => void, selectMode: boolean, onToggleSelect: (id: string) => void) {
  const { addToast } = useToast();
  const isIntegrated = INTEGRATED_TYPES.includes(source.type);
  const handleRemove = () => {
    const snapshot = source;
    onRemove(source.id);
    const verb = isIntegrated ? 'Disconnected' : 'Removed';
    addToast({
      type: 'info',
      message: `${verb} "${snapshot.name}".`,
      action: { label: 'Undo', onClick: () => onRestore(snapshot) },
    });
  };
  const handleCardClick = () => {
    if (selectMode) onToggleSelect(source.id);
    else onOpen();
  };
  return { handleRemove, handleCardClick, isIntegrated };
}

// Health dot for integrations — outlined, single color, three-state vocabulary.
function HealthDot({ health }: { health: 'healthy' | 'degraded' }) {
  const cls = health === 'healthy' ? 'bg-compliant' : 'bg-mitigated';
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${cls}`} aria-hidden />
      <span className="text-[0.6875rem] text-ink-500 capitalize">{health}</span>
    </span>
  );
}

function SourceCard(props: SourceCardProps) {
  return props.viewMode === 'list'
    ? <SourceRow {...props} />
    : <SourceTile {...props} />;
}

// Grid tile — primary card, slightly richer than the previous version. Folders
// get a count chip; integrations get a health dot + last sync.
function SourceTile({
  source, onOpen, onRemove, onRestore, onRenameInDetail,
  selectMode, selected, onToggleSelect,
}: SourceCardProps) {
  const { icon: TypeIcon, tone: typeTone, label: typeLabel } = TYPE_META[source.type];
  const Icon = source.isFolder ? FolderOpen : TypeIcon;
  const tone = source.isFolder ? 'text-evidence-700 bg-evidence-50' : typeTone;
  const [menuOpen, setMenuOpen] = useState(false);
  const { handleRemove, handleCardClick, isIntegrated } = useCardActions(
    source, onOpen, onRemove, onRestore, selectMode, onToggleSelect,
  );
  const health = isIntegrated ? integrationHealth(source.id) : null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleCardClick}
        className={`group w-full flex items-start gap-3 px-4 py-3.5 rounded-xl bg-canvas-elevated border transition-[colors,transform,box-shadow] cursor-pointer text-left active:scale-[0.99] ${
          selected
            ? 'border-brand-600 bg-brand-50/30 shadow-sm'
            : 'border-canvas-border hover:border-brand-200 hover:bg-brand-50/20 hover:shadow-sm'
        }`}
      >
        {selectMode && (
          <span
            className={`mt-1 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
              selected ? 'bg-brand-600 border-brand-600 text-white' : 'bg-paper-0 border-canvas-border'
            }`}
            aria-hidden
          >
            {selected && <Check size={11} strokeWidth={3} />}
          </span>
        )}
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-[1.06] ${tone}`}>
          <Icon size={17} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="text-[0.875rem] font-semibold text-ink-900 truncate" title={source.name}>{source.name}</div>
          </div>
          <div className="text-[0.75rem] text-ink-500 mt-0.5 tabular-nums truncate">
            {source.subtype}
          </div>
          {/* Footer line — health/last sync for integrations, type/date for files. */}
          <div className="mt-2 flex items-center gap-2 text-[0.6875rem] text-ink-400 tabular-nums">
            {health && <HealthDot health={health} />}
            {health && <span className="text-ink-300" aria-hidden>·</span>}
            <span>{isIntegrated ? `Synced ${formatRel(source.createdAt, TODAY)}` : typeLabel}</span>
            <span className="text-ink-300" aria-hidden>·</span>
            <span>{formatDate(source.createdAt)}</span>
          </div>
        </div>
        {!selectMode && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); setMenuOpen(o => !o); } }}
            className={`p-1 rounded-md text-ink-400 hover:text-ink-700 hover:bg-paper-50 transition-opacity cursor-pointer shrink-0 ${
              menuOpen ? 'opacity-100' : 'opacity-30 group-hover:opacity-100 [@media(hover:none)]:opacity-100'
            }`}
            aria-label="Source actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal size={16} />
          </span>
        )}
      </button>
      {menuOpen && (
        <SourceMenu
          source={source}
          onClose={() => setMenuOpen(false)}
          onRequestRemove={handleRemove}
          onRename={onRenameInDetail}
        />
      )}
    </div>
  );
}

// Dense list row — single line, scannable. Same affordances as the tile.
function SourceRow({
  source, onOpen, onRemove, onRestore, onRenameInDetail,
  selectMode, selected, onToggleSelect,
}: SourceCardProps) {
  const { icon: TypeIcon, tone: typeTone, label: typeLabel } = TYPE_META[source.type];
  const Icon = source.isFolder ? FolderOpen : TypeIcon;
  const tone = source.isFolder ? 'text-evidence-700 bg-evidence-50' : typeTone;
  const [menuOpen, setMenuOpen] = useState(false);
  const { handleRemove, handleCardClick, isIntegrated } = useCardActions(
    source, onOpen, onRemove, onRestore, selectMode, onToggleSelect,
  );
  const health = isIntegrated ? integrationHealth(source.id) : null;
  const displayType = source.isFolder ? 'Folder' : typeLabel;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleCardClick}
        className={`group w-full flex items-center gap-3 px-3.5 h-12 rounded-lg border transition-colors cursor-pointer text-left ${
          selected
            ? 'border-brand-600 bg-brand-50/30'
            : 'border-transparent hover:border-canvas-border hover:bg-canvas-elevated'
        }`}
      >
        {selectMode && (
          <span
            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
              selected ? 'bg-brand-600 border-brand-600 text-white' : 'bg-paper-0 border-canvas-border'
            }`}
            aria-hidden
          >
            {selected && <Check size={11} strokeWidth={3} />}
          </span>
        )}
        <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${tone}`}>
          <Icon size={14} />
        </div>
        <div className="flex-1 min-w-0 text-[0.8125rem] font-semibold text-ink-900 truncate" title={source.name}>
          {source.name}
        </div>
        <div className="hidden lg:block w-24 text-[0.6875rem] uppercase tracking-wide font-mono text-ink-500 shrink-0">
          {displayType}
        </div>
        <div className="hidden md:block flex-1 max-w-[18rem] text-[0.75rem] text-ink-500 truncate tabular-nums">
          {source.subtype}
        </div>
        <div className="hidden md:flex items-center gap-2 shrink-0 w-32 justify-end">
          {health && <HealthDot health={health} />}
        </div>
        <div className="text-[0.75rem] text-ink-400 tabular-nums shrink-0 w-24 text-right">
          {formatDate(source.createdAt)}
        </div>
        {!selectMode && (
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
        )}
      </button>
      {menuOpen && (
        <SourceMenu
          source={source}
          onClose={() => setMenuOpen(false)}
          onRequestRemove={handleRemove}
          onRename={onRenameInDetail}
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
        className="absolute right-2 top-12 z-40 w-48 rounded-md border border-paper-200 bg-paper-0 shadow-md py-1"
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

  if (tab === 'database') {
    return (
      <EmptyShell icon={Database}>
        <p className="text-[0.875rem] text-ink-700 font-medium">No databases connected.</p>
        <p className="text-[0.75rem] text-ink-500 mt-1 max-w-md mx-auto">
          Connect Snowflake, Postgres, BigQuery, Oracle, Athena and more from the Add source picker.
        </p>
        <div className="mt-4">
          <Button variant="primary" leftIcon={<Plus size={13} />} onClick={onOpenPicker}>Connect database</Button>
        </div>
      </EmptyShell>
    );
  }

  if (tab === 'api') {
    return (
      <EmptyShell icon={Globe}>
        <p className="text-[0.875rem] text-ink-700 font-medium">No API integrations yet.</p>
        <p className="text-[0.75rem] text-ink-500 mt-1 max-w-md mx-auto">
          REST and OAuth integrations are wired up by IT — Workday, NetSuite, JIRA, and more.
        </p>
        <div className="mt-4">
          <a
            href="mailto:support@irame.ai?subject=API%20integration%20request"
            onClick={onRequestIntegration}
            className="inline-flex items-center gap-2 px-3.5 h-9 rounded-lg bg-primary text-white text-sm font-medium shadow-sm shadow-brand-900/10 hover:bg-primary-hover hover:shadow-md hover:shadow-brand-900/15 transition-[background-color,box-shadow] duration-150"
          >
            <Plus size={13} />
            Request an API integration
          </a>
        </div>
      </EmptyShell>
    );
  }

  if (tab === 'cloud') {
    return (
      <EmptyShell icon={Cloud}>
        <p className="text-[0.875rem] text-ink-700 font-medium">No cloud storage connected.</p>
        <p className="text-[0.75rem] text-ink-500 mt-1 max-w-md mx-auto">
          S3, Google Drive, SharePoint, and OneDrive get wired up by IT once per workspace.
        </p>
        <div className="mt-4">
          <a
            href="mailto:support@irame.ai?subject=Cloud%20storage%20integration%20request"
            onClick={onRequestIntegration}
            className="inline-flex items-center gap-2 px-3.5 h-9 rounded-lg bg-primary text-white text-sm font-medium shadow-sm shadow-brand-900/10 hover:bg-primary-hover hover:shadow-md hover:shadow-brand-900/15 transition-[background-color,box-shadow] duration-150"
          >
            <Plus size={13} />
            Request cloud connection
          </a>
        </div>
      </EmptyShell>
    );
  }

  if (tab === 'session') {
    return (
      <EmptyShell icon={MessageSquare}>
        <p className="text-[0.875rem] text-ink-700 font-medium">No chat-attached files yet.</p>
        <p className="text-[0.75rem] text-ink-500 mt-1 max-w-md mx-auto">
          Drop a file into any IRA chat and it shows up here automatically — scoped to that conversation.
        </p>
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
    <div className="text-center py-16 rounded-xl border border-dashed border-canvas-border bg-canvas-elevated">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: n }).map((_, i) => (
              <div
                key={i}
                className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-canvas-elevated border border-canvas-border"
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
  const [tab, setTab] = useState<TabId>('all');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>(DEFAULT_DATE_FILTER);
  const [dateOpen, setDateOpen] = useState(false);
  const [activeSource, setActiveSource] = useState<DataSource | null>(null);
  // When the menu's Rename is clicked, we set this so the detail view enters
  // rename mode immediately on mount. Cleared after the detail view consumes it.
  const [pendingRename, setPendingRename] = useState(false);
  // Local sources state. SOURCES_STATE wins across remounts within a session;
  // first-time load uses INITIAL_SOURCES (the toggle near the top of the file).
  const [sources, setSources] = useState<DataSource[]>(() => SOURCES_STATE ?? INITIAL_SOURCES);
  // Single unified picker — same multi-tab UX as the chat composer's Add data.
  const [pickerOpen, setPickerOpen] = useState(false);
  // Expose an imperative `openPicker()` so the parent (KnowledgeHubView's
  // header) can trigger the same flow that the toolbar's Add source button uses.
  useImperativeHandle(ref, () => ({ openPicker: () => setPickerOpen(true) }), []);
  // Bulk-select state. selectMode reveals checkboxes; selectedIds tracks chosen ids.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
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
  // First-run hint: tracks transition from 0 → 1 source to fire the @-mention nudge once.
  const prevSourcesLenRef = useRef<number>(sources.length);

  // Predicate fn per tab — single source of truth for counts + visibility.
  const tabPredicate = (id: TabId) => (d: DataSource): boolean => {
    if (id === 'all')      return true;
    if (id === 'file')     return d.type === 'file' && !d.isFolder;
    if (id === 'folder')   return d.type === 'file' && d.isFolder === true;
    return d.type === id;
  };

  const tabCounts = useMemo<Record<TabId, number>>(() => ({
    all:      sources.length,
    file:     sources.filter(tabPredicate('file')).length,
    folder:   sources.filter(tabPredicate('folder')).length,
    database: sources.filter(tabPredicate('database')).length,
    api:      sources.filter(tabPredicate('api')).length,
    cloud:    sources.filter(tabPredicate('cloud')).length,
    session:  sources.filter(tabPredicate('session')).length,
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
      onStatsChange({ total: 0, files: 0, folders: 0, integrations: 0, totalBytes: 0 });
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
    onStatsChange({ total, files, folders, integrations, totalBytes, lastAdded });
  }, [sources, onStatsChange, displayMode]);

  const dateActive = isDateFilterActive(dateFilter);
  const isFiltered = search.trim() !== '' || dateActive;
  const dateLabel = dateFilterLabel(dateFilter);
  const clearAllFilters = () => { setSearch(''); setDateFilter(DEFAULT_DATE_FILTER); };

  const renameSource = (id: string, newName: string) => {
    setSources(prev => {
      const next = prev.map(s => s.id === id ? { ...s, name: newName } : s);
      SOURCES_STATE = next;
      return next;
    });
    setActiveSource(curr => curr && curr.id === id ? { ...curr, name: newName } : curr);
  };

  // Plain remove — SourceCard / bulk bar own the undo toast so we don't fire it twice.
  const removeSource = (id: string) => {
    setSources(prev => {
      const next = prev.filter(s => s.id !== id);
      SOURCES_STATE = next;
      return next;
    });
  };

  const restoreSource = (snapshot: DataSource) => {
    setSources(prev => {
      // Guard against double-restore (Undo clicked twice) so we don't duplicate.
      if (prev.some(s => s.id === snapshot.id)) return prev;
      const next = [snapshot, ...prev];
      SOURCES_STATE = next;
      return next;
    });
  };

  const restoreManySources = (snapshots: DataSource[]) => {
    setSources(prev => {
      const existing = new Set(prev.map(s => s.id));
      const additions = snapshots.filter(s => !existing.has(s.id));
      if (additions.length === 0) return prev;
      const next = [...additions, ...prev];
      SOURCES_STATE = next;
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  // Bulk remove: snapshot everything first, drop them, then surface a single undo.
  const removeSelected = () => {
    const snapshots = sources.filter(s => selectedIds.has(s.id));
    if (snapshots.length === 0) { exitSelectMode(); return; }
    const ids = new Set(snapshots.map(s => s.id));
    setSources(prev => {
      const next = prev.filter(s => !ids.has(s.id));
      SOURCES_STATE = next;
      return next;
    });
    const allIntegrated = snapshots.every(s => INTEGRATED_TYPES.includes(s.type));
    const verb = allIntegrated ? 'Disconnected' : 'Removed';
    const noun = snapshots.length === 1 ? 'source' : 'sources';
    addToast({
      type: 'info',
      message: `${verb} ${snapshots.length} ${noun}.`,
      action: { label: 'Undo', onClick: () => restoreManySources(snapshots) },
    });
    exitSelectMode();
  };

  // Reset search + date filter on tab switch so each tab opens "fresh". Avoids
  // confusion when the user toggles tabs and sees an unexplained empty state.
  useEffect(() => {
    setSearch('');
    setDateFilter(DEFAULT_DATE_FILTER);
    // Exiting select-mode on tab change keeps the bulk bar coherent with what's visible.
    exitSelectMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

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


  // Keep selectedIds in sync with the actual source list — drop ids for sources
  // that have been removed (e.g. via undo-rollback or filter switching).
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const ids = new Set(sources.map(s => s.id));
    let changed = false;
    const next = new Set<string>();
    selectedIds.forEach(id => { if (ids.has(id)) next.add(id); else changed = true; });
    if (changed) setSelectedIds(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources]);

  const handlePickerConfirm = (selections: AttachmentSelection[]) => {
    const uploads   = selections.filter((s): s is Extract<AttachmentSelection, { kind: 'upload' }>     => s.kind === 'upload');
    const dbConnect = selections.filter((s): s is Extract<AttachmentSelection, { kind: 'connect-db' }> => s.kind === 'connect-db');

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
      setSources(prev => {
        const taken = new Set(prev.map(s => s.name));
        // Seed data is anchored to TODAY (2026-04-23); use the same anchor for
        // new uploads so they land in the visible 'Today' bucket and pass the
        // default date filter, which is computed relative to TODAY.
        const nowIso = TODAY.toISOString();
        const today  = nowIso.slice(0, 10);

        // ── Loose-file sources: one card per file ────────────────────────
        const looseAdds: DataSource[] = loose.map(u => {
          const finalName = dedupeName(u.name, taken);
          taken.add(finalName);
          const sourceId = `upl-${u.localId}`;
          // Single-file content for the detail view.
          DATASET_FILES[sourceId] = [{
            id:         `${sourceId}-1`,
            name:       u.name,
            format:     fileFormat(u.name),
            sizeBytes:  u.sizeBytes,
            uploadedAt: today,
            status:     'processed',
          }];
          return {
            id:        sourceId,
            name:      finalName,
            type:      'file' as SourceType,
            subtype:   `${formatExt(finalName)} · ${formatBytesShort(u.sizeBytes)}`,
            createdAt: nowIso,
          };
        });

        // ── Folder sources: one card per folder, files inside ────────────
        const folderAdds: DataSource[] = [];
        folders.forEach((files, folderName) => {
          const finalName = dedupeName(folderName, taken);
          taken.add(finalName);
          const sourceId  = `upl-folder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const totalSize = files.reduce((sum, f) => sum + f.sizeBytes, 0);
          // File contents — strip the root folder prefix so display is "Q1/sales.csv".
          DATASET_FILES[sourceId] = files.map((f, i) => ({
            id:         `${sourceId}-${i + 1}`,
            name:       f.path ? f.path.replace(`${folderName}/`, '') : f.name,
            format:     fileFormat(f.name),
            sizeBytes:  f.sizeBytes,
            uploadedAt: today,
            status:     'processed',
          }));
          folderAdds.push({
            id:        sourceId,
            name:      finalName,
            type:      'file' as SourceType,
            isFolder:  true,
            subtype:   `Folder · ${files.length} ${files.length === 1 ? 'file' : 'files'} · ${formatBytesShort(totalSize)}`,
            createdAt: nowIso,
          });
        });

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

        const next = [...folderAdds, ...looseAdds, ...dbAdds, ...prev];
        SOURCES_STATE = next;
        return next;
      });
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
  const buckets = bucketByDate(visible);

  // Full-page detail replaces the grid when a source is active.
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

  // ── Demo override: loading skeleton ──────────────────────────────────────
  if (displayMode === 'loading') {
    return <CatalogLoadingSkeleton />;
  }

  // ── True-empty state ─────────────────────────────────────────────────────
  // Distinct from the filter-empty state below (which fires when there are
  // sources but the search/date filters hide them). This one is the
  // first-run welcome — no sources at all, OR the demo override is forcing
  // the empty view. Calm, single-card layout: icon → headline → copy →
  // primary CTA → supported-types footer.
  if (displayMode === 'empty' || sources.length === 0) {
    return (
      <>
        <div className="rounded-2xl border border-canvas-border bg-canvas-elevated">
          <div className="flex flex-col items-center justify-center text-center py-20 px-8">
            <div className="w-14 h-14 rounded-2xl border border-paper-200 bg-paper-0 flex items-center justify-center mb-6">
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
              Supports PDF <span className="text-ink-300">·</span> CSV <span className="text-ink-300">·</span> XLSX <span className="text-ink-300">·</span> DOC.
              {' '}Connect PostgreSQL <span className="text-ink-300">·</span> MySQL <span className="text-ink-300">·</span> Snowflake <span className="text-ink-300">·</span> Oracle <span className="text-ink-300">·</span> SQL Server <span className="text-ink-300">·</span> BigQuery.
            </p>
          </div>
        </div>

        <DataPickerModal
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onConfirm={handlePickerConfirm}
          title="Add data"
          confirmLabel="Add"
          mode="kh-add"
        />
      </>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Single tab row: granular type segment ── */}
      {/* Wrapped in an overflow-x scroller so 7 segments survive narrow viewports
          without wrapping. A soft hairline under the row separates filters from
          content even when nothing is selected. */}
      <div className="border-b border-canvas-border -mx-1">
        <div className="flex items-center gap-0.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map(t => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            const count = tabCounts[t.id];
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex items-center gap-2 px-3.5 h-10 text-[0.8125rem] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isActive ? 'text-brand-700' : 'text-ink-500 hover:text-ink-800'
                }`}
              >
                <Icon size={13} className={isActive ? 'text-brand-700' : 'text-ink-400'} />
                <span>{t.label}</span>
                <span
                  className={`tabular-nums text-[0.6875rem] px-1.5 h-4 rounded-full inline-flex items-center ${
                    isActive ? 'bg-brand-100 text-brand-700 font-semibold' : 'bg-paper-100 text-ink-500'
                  }`}
                >
                  {count}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="kh-tab-underline"
                    className="absolute bottom-0 left-2 right-2 h-[2px] bg-brand-600 rounded-full"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── One-row toolbar: search · date · view-toggle · select ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[14rem] max-w-xl">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
          <input
            type="text"
            placeholder={`Search ${tab === 'all' ? 'all sources' : TABS.find(t => t.id === tab)!.label.toLowerCase()}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-8 h-9 rounded-lg border border-canvas-border bg-paper-50 text-[0.8125rem] text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 focus:bg-canvas-elevated transition-colors"
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

        <DateFilterPicker
          filter={dateFilter}
          open={dateOpen}
          onToggle={() => setDateOpen(p => !p)}
          onClose={() => setDateOpen(false)}
          onApply={(next) => { setDateFilter(next); setDateOpen(false); }}
          today={TODAY}
        />

        {/* Grid / list toggle — segmented pair, single-click swap. */}
        <div className="inline-flex items-center p-0.5 rounded-lg border border-canvas-border bg-paper-50">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors cursor-pointer ${
              viewMode === 'grid' ? 'bg-canvas-elevated text-brand-700 shadow-sm' : 'text-ink-400 hover:text-ink-700'
            }`}
            aria-label="Grid view"
            aria-pressed={viewMode === 'grid'}
            title="Grid view"
          >
            <LayoutGrid size={14} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors cursor-pointer ${
              viewMode === 'list' ? 'bg-canvas-elevated text-brand-700 shadow-sm' : 'text-ink-400 hover:text-ink-700'
            }`}
            aria-label="List view"
            aria-pressed={viewMode === 'list'}
            title="List view"
          >
            <Rows3 size={14} />
          </button>
        </div>

        <Button
          variant="outline"
          size="sm"
          leftIcon={selectMode ? <X size={13} /> : <CheckSquare size={13} />}
          onClick={() => {
            if (selectMode) exitSelectMode();
            else setSelectMode(true);
          }}
        >
          {selectMode ? 'Done' : 'Select'}
        </Button>

        {/* Primary CTA — moved out of the page header so the chrome stays
            calm; lives next to the other catalog-scoped controls. */}
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus size={13} />}
          onClick={() => setPickerOpen(true)}
          title="Add source (N)"
        >
          Add source
        </Button>
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

          {buckets.map(b => (
            <div key={b.id}>
              {/* Bucket header — mono uppercase carries the section opener
                  on its own. No decorative hairline. */}
              <div className="text-[0.75rem] font-mono uppercase tracking-wider text-ink-500 tabular-nums mb-3">
                {b.label} <span className="text-ink-400">· {b.items.length}</span>
              </div>
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {b.items.map(d => (
                    <SourceCard
                      key={d.id}
                      source={d}
                      viewMode="grid"
                      onOpen={() => setActiveSource(d)}
                      onRemove={removeSource}
                      onRestore={restoreSource}
                      onRenameInDetail={() => { setPendingRename(true); setActiveSource(d); }}
                      selectMode={selectMode}
                      selected={selectedIds.has(d.id)}
                      onToggleSelect={toggleSelect}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden divide-y divide-canvas-border">
                  {b.items.map(d => (
                    <SourceCard
                      key={d.id}
                      source={d}
                      viewMode="list"
                      onOpen={() => setActiveSource(d)}
                      onRemove={removeSource}
                      onRestore={restoreSource}
                      onRenameInDetail={() => { setPendingRename(true); setActiveSource(d); }}
                      selectMode={selectMode}
                      selected={selectedIds.has(d.id)}
                      onToggleSelect={toggleSelect}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </motion.div>
      </AnimatePresence>

      {/* ── Shared add-data picker (Upload tab vs DB tab depends on entry button) ── */}
      <DataPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={handlePickerConfirm}
        title="Add data"
        confirmLabel="Add"
        mode="kh-add"
      />

      {/* ── Sticky bulk action bar ──
          Surfaces once a card is selected. Label adapts (Remove vs Disconnect)
          based on whether every selected source is integrated. */}
      <AnimatePresence>
        {selectMode && selectedIds.size > 0 && (() => {
          const selected = sources.filter(s => selectedIds.has(s.id));
          const allIntegrated = selected.length > 0 && selected.every(s => INTEGRATED_TYPES.includes(s.type));
          return (
            <motion.div
              key="bulk-bar"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-3 py-2 rounded-lg bg-canvas-elevated border border-canvas-border shadow-md"
            >
              <span className="text-[0.75rem] font-medium text-ink-800 tabular-nums pl-1">
                {selectedIds.size} selected
              </span>
              <div className="w-px h-5 bg-canvas-border" aria-hidden />
              <Button variant="ghost" onClick={exitSelectMode}>Cancel</Button>
              <Button
                variant="destructive"
                leftIcon={allIntegrated ? <Unplug size={13} /> : <Trash2 size={13} />}
                onClick={removeSelected}
              >
                {allIntegrated ? 'Disconnect' : 'Remove'}
              </Button>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
});

export default DataSourcesView;
