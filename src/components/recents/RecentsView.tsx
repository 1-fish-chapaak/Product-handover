import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare, Workflow, Star, Search, Plus, Clock, X, Bookmark,
} from 'lucide-react';
import type { View } from '../../hooks/useAppState';
import { CHAT_HISTORY, WORKFLOWS } from '../../data/mockData';
import {
  DateFilterPicker, dateInFilter, isDateFilterActive, dateFilterLabel,
  DEFAULT_DATE_FILTER, type DateFilter,
} from '../shared/DateFilterPicker';
import {
  readBookmarkedMessages, writeBookmarkedMessages, type BookmarkedMessage,
} from '../../utils/bookmarkedMessages';

interface Props {
  setView: (v: View) => void;
  openChat: (chatId: string | null) => void;
  openWorkflowExecutor: (workflowId: string) => void;
}

type TabId = 'chats' | 'workflows' | 'favourites';

const FAVES_KEY = 'recents.favourites.v1';

interface Tab {
  id: TabId;
  label: string;
  icon: typeof MessageSquare;
}

const TABS: Tab[] = [
  { id: 'chats',      label: 'Chats',         icon: MessageSquare },
  { id: 'workflows',  label: 'Workflow runs', icon: Workflow },
  { id: 'favourites', label: 'Favourites',    icon: Star },
];

// ─── Time helpers ────────────────────────────────────────────────────────────
// Today (mocked at 2026-04-23 to match the rest of the app's mock anchor).

const NOW = new Date('2026-04-23T04:30:00');
const DAY_MS = 24 * 60 * 60 * 1000;

function formatRelative(isoOrLabel: string): string {
  // Existing mocks store strings like "Mar 20, 2026". Parse if possible.
  const d = new Date(isoOrLabel);
  if (Number.isNaN(d.getTime())) return isoOrLabel;

  const diff = NOW.getTime() - d.getTime();

  if (diff < DAY_MS && d.toDateString() === NOW.toDateString()) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
  }
  if (diff < 7 * DAY_MS) {
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  }
  if (d.getFullYear() === NOW.getFullYear()) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Synthesised recents data ────────────────────────────────────────────────
// CHAT_HISTORY only has 5 items — pad with a few synthetic ones so the page
// reads like the screenshot (~15 rows). All anchored to NOW.

interface ChatRow { id: string; title: string; ts: Date; }
interface WorkflowRunRow { id: string; wfId: string; wfName: string; ts: Date; status: 'success' | 'pending' | 'failed'; rows: number; }

function buildChatRows(): ChatRow[] {
  const synthetic: { title: string; offset: number }[] = [
    { title: 'Auditor journey hackathon vision', offset: 1 * DAY_MS },
    { title: 'Audit platform architecture redesign', offset: 1 * DAY_MS + 2 * 3600_000 },
    { title: 'Convert iFrame branded PDF to Word document', offset: 1 * DAY_MS + 5 * 3600_000 },
    { title: 'Amazon TRC compliance dashboard prototype showcase', offset: 1 * DAY_MS + 7 * 3600_000 },
    { title: 'Client demo with iFrame vendor folders', offset: 2 * DAY_MS },
    { title: 'Databricks workspace data migration planning', offset: 3 * DAY_MS },
    { title: 'Convert to Word file', offset: 3 * DAY_MS + 4 * 3600_000 },
    { title: 'Querying SAP data lake for analytics', offset: 3 * DAY_MS + 6 * 3600_000 },
    { title: 'Numerical range notation', offset: 4 * DAY_MS },
  ];
  const real: ChatRow[] = CHAT_HISTORY.map(c => ({
    id: c.id,
    title: c.title,
    ts: new Date(c.timestamp),
  }));
  const synth: ChatRow[] = synthetic.map((s, i) => ({
    id: `ch-syn-${i}`,
    title: s.title,
    ts: new Date(NOW.getTime() - s.offset),
  }));
  return [...synth, ...real].sort((a, b) => b.ts.getTime() - a.ts.getTime());
}

function buildWorkflowRunRows(): WorkflowRunRow[] {
  // For each workflow, synth 2 recent runs at fictional times.
  const rows: WorkflowRunRow[] = [];
  WORKFLOWS.forEach((wf, i) => {
    for (let r = 0; r < 2; r++) {
      const offsetH = (i * 5 + r * 17) % 96; // spread runs across last 4 days
      const ts = new Date(NOW.getTime() - offsetH * 3600_000);
      const status: WorkflowRunRow['status'] =
        r === 0 && i % 5 === 4 ? 'failed' :
        r === 0 && i % 4 === 3 ? 'pending' :
        'success';
      rows.push({
        id: `${wf.id}-run-${r}`,
        wfId: wf.id,
        wfName: wf.name,
        ts,
        status,
        rows: 200 + ((i * 137 + r * 53) % 1800),
      });
    }
  });
  return rows.sort((a, b) => b.ts.getTime() - a.ts.getTime());
}

const STATUS_TONE: Record<WorkflowRunRow['status'], { label: string; cls: string }> = {
  success: { label: 'Succeeded', cls: 'bg-compliant-50 text-compliant-700' },
  pending: { label: 'Pending',   cls: 'bg-mitigated-50 text-mitigated-700' },
  failed:  { label: 'Failed',    cls: 'bg-risk-50 text-risk-700' },
};

// ─── Star (favourite) ────────────────────────────────────────────────────────

function FavToggle({ on, onClick }: { on: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-1 rounded-md transition-colors cursor-pointer ${
        on ? 'text-mitigated-700' : 'text-ink-400 hover:text-ink-700 opacity-0 group-hover:opacity-100'
      }`}
      aria-label={on ? 'Remove from favourites' : 'Add to favourites'}
      title={on ? 'Remove from favourites' : 'Add to favourites'}
    >
      <Star size={14} fill={on ? 'currentColor' : 'none'} strokeWidth={2} />
    </button>
  );
}

// ─── Row primitive ───────────────────────────────────────────────────────────

interface RowProps {
  icon: React.ElementType;
  title: string;
  meta?: string;
  trailing?: React.ReactNode;
  ts: Date;
  onClick?: () => void;
  fav: boolean;
  onToggleFav: (e: React.MouseEvent) => void;
}

// The row carries its own actions (favourite star), so it can't be a <button> —
// nesting a button inside a button is invalid HTML. It's a role="button" div
// with the keyboard behaviour a native button would have given us.
function RecentRow({ icon: Icon, title, meta, trailing, ts, onClick, fav, onToggleFav }: RowProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      className="group w-full flex items-center gap-3 px-4 h-12 text-left rounded-md hover:bg-brand-50/50 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      <Icon size={15} className="text-ink-400 shrink-0" />
      <div className="flex-1 min-w-0 flex items-baseline gap-3">
        <span className="text-[0.875rem] text-ink-800 truncate">{title}</span>
        {meta && <span className="text-[0.75rem] text-ink-500 truncate hidden md:inline">{meta}</span>}
      </div>
      {trailing}
      <FavToggle on={fav} onClick={onToggleFav} />
      <span className="text-[0.75rem] text-ink-500 tabular-nums w-20 text-right shrink-0">{formatRelative(ts.toISOString())}</span>
    </div>
  );
}

// ─── RecentsView ─────────────────────────────────────────────────────────────

export default function RecentsView({ setView, openChat, openWorkflowExecutor }: Props) {
  const [tab, setTab] = useState<TabId>('chats');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>(DEFAULT_DATE_FILTER);
  const [dateOpen, setDateOpen] = useState(false);

  const [favourites, setFavourites] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(FAVES_KEY) || '[]')); }
    catch { return new Set(); }
  });
  useEffect(() => { localStorage.setItem(FAVES_KEY, JSON.stringify(Array.from(favourites))); }, [favourites]);

  const toggleFav = (id: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setFavourites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Bookmarked chat messages — saved from ChatView's hover-action row.
  // Live in their own localStorage key and rehydrate on the cross-component
  // `chat-bookmarks-updated` event so toggling from chat reflects immediately.
  const [bookmarks, setBookmarks] = useState<BookmarkedMessage[]>(() => readBookmarkedMessages());
  useEffect(() => {
    const rehydrate = () => setBookmarks(readBookmarkedMessages());
    window.addEventListener('chat-bookmarks-updated', rehydrate);
    window.addEventListener('storage', rehydrate);
    return () => {
      window.removeEventListener('chat-bookmarks-updated', rehydrate);
      window.removeEventListener('storage', rehydrate);
    };
  }, []);
  const removeBookmark = (msgId: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = bookmarks.filter(b => b.msgId !== msgId);
    setBookmarks(next);
    writeBookmarkedMessages(next);
  };

  const chatRows = useMemo(buildChatRows, []);
  const workflowRows = useMemo(buildWorkflowRunRows, []);

  const matchesText = (text: string) => !search || text.toLowerCase().includes(search.toLowerCase());
  const matchesDate = (ts: Date) => dateInFilter(ts.toISOString(), dateFilter, NOW);

  const filteredChats = chatRows.filter(c => matchesText(c.title) && matchesDate(c.ts));
  const filteredWorkflows = workflowRows.filter(w => matchesText(w.wfName) && matchesDate(w.ts));

  type FavEntry =
    | { kind: 'chat'; ts: Date; row: ChatRow }
    | { kind: 'workflow'; ts: Date; row: WorkflowRunRow }
    | { kind: 'bookmark'; ts: Date; row: BookmarkedMessage };
  const favouriteEntries: FavEntry[] = [
    ...chatRows.filter(c => favourites.has(c.id) && matchesText(c.title) && matchesDate(c.ts))
      .map<FavEntry>(c => ({ kind: 'chat', ts: c.ts, row: c })),
    ...workflowRows.filter(w => favourites.has(w.id) && matchesText(w.wfName) && matchesDate(w.ts))
      .map<FavEntry>(w => ({ kind: 'workflow', ts: w.ts, row: w })),
    ...bookmarks.filter(b => matchesText(b.text) && matchesDate(new Date(b.timestamp)))
      .map<FavEntry>(b => ({ kind: 'bookmark', ts: new Date(b.timestamp), row: b })),
  ].sort((a, b) => b.ts.getTime() - a.ts.getTime());

  // Counts for the active-filters bar.
  const dateActive = isDateFilterActive(dateFilter);
  const dateLabel = dateFilterLabel(dateFilter);
  const isFiltered = search.trim() !== '' || dateActive;
  const totalFavourites = favourites.size + bookmarks.length;
  const tabTotal = tab === 'chats' ? chatRows.length : tab === 'workflows' ? workflowRows.length : totalFavourites;
  const tabVisible = tab === 'chats' ? filteredChats.length : tab === 'workflows' ? filteredWorkflows.length : favouriteEntries.length;
  const clearAllFilters = () => { setSearch(''); setDateFilter(DEFAULT_DATE_FILTER); };

  const newButtonLabel = tab === 'chats' ? 'New chat' : tab === 'workflows' ? 'New run' : null;
  const onNewClick = () => {
    if (tab === 'chats') openChat(null);
    if (tab === 'workflows') setView('workflow-templates');
  };

  return (
    <div className="h-full overflow-y-auto bg-canvas">
      {/* Page header */}
      <div className="border-b border-canvas-border bg-canvas-elevated">
        <div className="max-w-6xl mx-auto px-8 pt-8 pb-0">
          <div className="font-mono text-[0.6875rem] text-ink-500 mb-2 tracking-tight">
            Recents · {TABS.find(t => t.id === tab)!.label}
          </div>

          <div className="flex items-end justify-between mb-6">
            <div>
              <h1 className="text-[2.5rem] font-semibold tracking-tight text-ink-900 leading-[1.1]">
                {TABS.find(t => t.id === tab)!.label}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {newButtonLabel && (
                <button
                  onClick={onNewClick}
                  className="flex items-center gap-2 px-4 h-10 rounded-md bg-brand-600 hover:bg-brand-500 active:bg-brand-800 text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                  {newButtonLabel}
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-0 border-b border-transparent -mb-px">
            {TABS.map(t => {
              const Icon = t.icon;
              const isActive = tab === t.id;
              const count = t.id === 'favourites' ? totalFavourites : t.id === 'chats' ? chatRows.length : workflowRows.length;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`relative flex items-center gap-2 px-4 h-11 text-[0.8125rem] font-medium transition-colors cursor-pointer ${
                    isActive ? 'text-brand-700' : 'text-ink-500 hover:text-ink-700'
                  }`}
                >
                  <Icon size={14} />
                  {t.label}
                  <span className={`tabular-nums text-[0.6875rem] ${isActive ? 'text-brand-600' : 'text-ink-400'}`}>
                    {count}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="recents-tab-bar"
                      className="absolute left-0 right-0 -bottom-px h-[2px] bg-brand-600"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Search + date filter toolbar */}
      <div className="max-w-6xl mx-auto px-8 pt-6 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              placeholder={`Search ${TABS.find(t => t.id === tab)!.label.toLowerCase()}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 h-9 rounded-md border border-canvas-border bg-canvas-elevated text-[0.8125rem] text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 transition-colors"
            />
          </div>
          <DateFilterPicker
            filter={dateFilter}
            open={dateOpen}
            onToggle={() => setDateOpen(p => !p)}
            onClose={() => setDateOpen(false)}
            onApply={(next) => { setDateFilter(next); setDateOpen(false); }}
            today={NOW}
          />
        </div>

        {/* Active filters bar — surfaces what's filtering + clear escape, with count. */}
        {isFiltered && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[0.75rem] text-ink-500 tabular-nums">
              <span className="font-semibold text-ink-700">{tabVisible}</span> of {tabTotal} {tabTotal === 1 ? 'item' : 'items'}
            </span>
            <span className="text-[0.75rem] text-ink-400">·</span>
            {search.trim() && (
              <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1 h-7 rounded-full bg-brand-50 border border-brand-200 text-[0.75rem] text-brand-700">
                Search: <span className="font-semibold">"{search.trim()}"</span>
                <button
                  onClick={() => setSearch('')}
                  className="p-0.5 rounded-full hover:bg-brand-100 cursor-pointer"
                  aria-label="Clear search filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}
            {dateActive && (
              <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1 h-7 rounded-full bg-brand-50 border border-brand-200 text-[0.75rem] text-brand-700">
                Date: <span className="font-semibold">{dateLabel}</span>
                <button
                  onClick={() => setDateFilter(DEFAULT_DATE_FILTER)}
                  className="p-0.5 rounded-full hover:bg-brand-100 cursor-pointer"
                  aria-label="Clear date filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}
            <button
              onClick={clearAllFilters}
              className="text-[0.75rem] font-medium text-brand-700 hover:text-brand-800 hover:underline cursor-pointer ml-1"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-8 py-6">
        <AnimatePresence mode="wait">
          {tab === 'chats' && (
            <motion.div
              key="chats"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
              className="space-y-0.5"
            >
              {filteredChats.map(c => (
                <RecentRow
                  key={c.id}
                  icon={MessageSquare}
                  title={c.title}
                  ts={c.ts}
                  onClick={() => openChat(c.id)}
                  fav={favourites.has(c.id)}
                  onToggleFav={toggleFav(c.id)}
                />
              ))}
              {filteredChats.length === 0 && (
                isFiltered
                  ? <FilteredEmptyState label="chats" onClear={clearAllFilters} />
                  : <EmptyState label="chats" />
              )}
            </motion.div>
          )}

          {tab === 'workflows' && (
            <motion.div
              key="workflows"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
              className="space-y-0.5"
            >
              {filteredWorkflows.map(w => {
                const tone = STATUS_TONE[w.status];
                return (
                  <RecentRow
                    key={w.id}
                    icon={Workflow}
                    title={w.wfName}
                    meta={`${w.rows.toLocaleString()} rows scanned`}
                    trailing={
                      <span className={`inline-flex items-center px-2.5 h-6 rounded-full text-[0.75rem] font-medium whitespace-nowrap ${tone.cls}`}>
                        {tone.label}
                      </span>
                    }
                    ts={w.ts}
                    onClick={() => openWorkflowExecutor(w.wfId)}
                    fav={favourites.has(w.id)}
                    onToggleFav={toggleFav(w.id)}
                  />
                );
              })}
              {filteredWorkflows.length === 0 && (
                isFiltered
                  ? <FilteredEmptyState label="workflow runs" onClear={clearAllFilters} />
                  : <EmptyState label="workflow runs" />
              )}
            </motion.div>
          )}

          {tab === 'favourites' && (
            <motion.div
              key="favourites"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
              className="space-y-0.5"
            >
              {favouriteEntries.length === 0 && (
                isFiltered ? (
                  <FilteredEmptyState label="favourites" onClear={clearAllFilters} />
                ) : (
                  <div className="text-center py-16">
                    <Star size={28} className="mx-auto text-ink-400 mb-3" />
                    <p className="text-[0.875rem] text-ink-500 mb-1">No favourites yet.</p>
                    <p className="text-[0.75rem] text-ink-400">Hover any chat or workflow run and click the star, or bookmark a message inside a chat to pin it here.</p>
                  </div>
                )
              )}
              {favouriteEntries.map(e => {
                if (e.kind === 'chat') {
                  return (
                    <RecentRow
                      key={`chat-${e.row.id}`}
                      icon={MessageSquare}
                      title={e.row.title}
                      ts={e.row.ts}
                      onClick={() => openChat(e.row.id)}
                      fav={true}
                      onToggleFav={toggleFav(e.row.id)}
                    />
                  );
                }
                if (e.kind === 'workflow') {
                  const tone = STATUS_TONE[e.row.status];
                  return (
                    <RecentRow
                      key={`wf-${e.row.id}`}
                      icon={Workflow}
                      title={e.row.wfName}
                      meta={`${e.row.rows.toLocaleString()} rows`}
                      trailing={
                        <span className={`inline-flex items-center px-2.5 h-6 rounded-full text-[0.75rem] font-medium whitespace-nowrap ${tone.cls}`}>
                          {tone.label}
                        </span>
                      }
                      ts={e.row.ts}
                      onClick={() => openWorkflowExecutor(e.row.wfId)}
                      fav={true}
                      onToggleFav={toggleFav(e.row.id)}
                    />
                  );
                }
                // kind === 'bookmark' — a saved chat message.
                return (
                  <BookmarkRow
                    key={`bm-${e.row.msgId}`}
                    bookmark={e.row}
                    onOpen={() => e.row.chatId && openChat(e.row.chatId)}
                    onRemove={removeBookmark(e.row.msgId)}
                  />
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-[0.6875rem] text-ink-400 text-center pt-8 pb-4 flex items-center justify-center gap-1.5">
          <Clock size={11} />
          Times shown relative to today (mock anchor 2026-04-23).
        </div>
      </div>
    </div>
  );
}

// ─── Bookmark row — saved chat message ──────────────────────────────────────
// Distinct from the chat/workflow rows: the message text is the title (it's
// the atom the user chose to keep), and the chat title sits as a secondary
// "in …" label. Trailing control is a single Remove (×) because there's no
// "open the exact message" route — clicking the row opens its chat.

function BookmarkRow({
  bookmark, onOpen, onRemove,
}: {
  bookmark: BookmarkedMessage;
  onOpen: () => void;
  onRemove: (e: React.MouseEvent) => void;
}) {
  const ts = new Date(bookmark.timestamp);
  const titleSnippet = bookmark.text.length > 90
    ? bookmark.text.slice(0, 87).trimEnd() + '…'
    : bookmark.text;
  // role="button" div, not <button> — it holds the Remove action, and a button
  // can't contain a button. A bookmark whose chat is gone isn't openable, so it
  // drops out of the tab order and reports itself disabled.
  const openable = Boolean(bookmark.chatId);
  return (
    <div
      role="button"
      tabIndex={openable ? 0 : -1}
      aria-disabled={!openable}
      onClick={openable ? onOpen : undefined}
      onKeyDown={(e) => {
        if (!openable) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`group w-full flex items-center gap-3 px-4 h-12 text-left rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
        openable ? 'hover:bg-brand-50/50 cursor-pointer' : 'cursor-default'
      }`}
    >
      <Bookmark size={14} className="text-mitigated-700 fill-mitigated-700 shrink-0" />
      <div className="flex-1 min-w-0 flex items-baseline gap-3">
        <span className="text-[0.875rem] text-ink-800 truncate">{titleSnippet}</span>
        <span className="text-[0.75rem] text-ink-500 truncate hidden md:inline">in &ldquo;{bookmark.chatTitle}&rdquo;</span>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="p-1 rounded-md text-ink-400 hover:text-ink-700 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        aria-label="Remove bookmark"
        title="Remove bookmark"
      >
        <X size={13} />
      </button>
      <span className="text-[0.75rem] text-ink-500 tabular-nums w-20 text-right shrink-0">{formatRelative(ts.toISOString())}</span>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-center py-16">
      <Search size={28} className="mx-auto text-ink-400 mb-3" />
      <p className="text-[0.875rem] text-ink-500">No {label} match your search.</p>
    </div>
  );
}

function FilteredEmptyState({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <div className="text-center py-16">
      <Search size={28} className="mx-auto text-ink-400 mb-3" />
      <p className="text-[0.875rem] text-ink-700 font-medium">No {label} match your filters.</p>
      <p className="text-[0.75rem] text-ink-500 mt-1">Try widening the date range or clearing filters.</p>
      <button
        onClick={onClear}
        className="inline-flex items-center gap-2 mt-4 px-3 h-9 rounded-md border border-brand-300 bg-brand-50 text-brand-700 text-[0.75rem] font-semibold hover:bg-brand-100 transition-colors cursor-pointer"
      >
        <X size={13} />
        Clear filters
      </button>
    </div>
  );
}
