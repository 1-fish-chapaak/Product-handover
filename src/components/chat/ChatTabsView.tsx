/* eslint-disable react-hooks/refs --
   The experimental react-hooks/refs rule false-positives on the <div ref={splitRef}>
   subtree here, flagging the `tabs.map` of <ChatView> children as "ref access during
   render". This component never reads a ref's `.current` during render: `splitRef` is
   only a ref={} assignment, and `tabsRef` / `messagesRef` are read solely inside
   callbacks and effects. Verified by inspection. */

// ─── In-app chat tabs ────────────────────────────────────────────────────────
// "New chat in a new tab" for the chat screen — browser-like tabs (think Chrome
// Ctrl+T / a terminal's new tab), but inside the app, on the chat surface only.
// Wraps ChatView; the rest of the app still talks to a single chat mount.
//
// Behaviour:
//  • The "+" / "New chat" button on the strip opens a fresh, empty tab.
//  • Clicking a Recents/history chat opens it in a NEW tab — or jumps to the
//    existing tab if that conversation is already open (no duplicates).
//  • Each tab is FULLY independent: its own conversation AND its own results
//    ("artifact") panel state — switching tabs never bleeds state between them.
//  • Tabs and their conversations survive a page reload (saved via
//    chatTabsStorage → localStorage).
//  • Closing the active tab activates a neighbour; closing the last tab leaves a
//    single fresh "New chat" (the strip never reaches zero tabs).
//
// How it works:
//  • Every tab's <ChatView> stays MOUNTED; inactive ones are hidden with
//    display:none. Switching tabs is instant and preserves each ChatView's full
//    in-memory state (no remount, no reload).
//  • ChatTabsView owns the per-tab results-panel state (DEFAULT_ARTIFACT) and
//    renders only the ACTIVE tab's panel on the right, behind a single shared,
//    persisted resize width.
//  • One-shot seeds (initialQuery / workflowRunSeed / composerDraft /
//    workflowBuilderSeedPrompt) are routed to the active tab only.
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Plus, X } from 'lucide-react';
import ChatView, { type ChatMessage, type ChatViewProps } from './ChatView';
import ArtifactPanel from '../artifacts/ArtifactPanel';
import ChatWorkflowWorkspace from './ChatWorkflowWorkspace';
import type { ArtifactTab } from '../../hooks/useAppState';
import { CHAT_HISTORY, CHAT_CONVERSATIONS, type WorkflowTypeId } from '../../data/mockData';
import {
  genTabId,
  readTabsState,
  writeTabsState,
  readTabMessages,
  writeTabMessages,
  clearTabMessages,
  type PersistedTab,
} from './chatTabsStorage';

// Per-tab results-panel ("artifact") state. Each tab owns its own copy so the
// panel is fully independent across tabs (Option B).
interface ArtifactState {
  showArtifacts: boolean;
  artifactMode: 'query' | 'workflow';
  activeArtifactTab: ArtifactTab;
  workflowType: WorkflowTypeId | null;
  workflowCanvasStage: number;
  queryAssumptions: string[];
}
const DEFAULT_ARTIFACT: ArtifactState = {
  showArtifacts: false,
  artifactMode: 'query',
  activeArtifactTab: 'sources',
  workflowType: null,
  workflowCanvasStage: 0,
  queryAssumptions: [],
};

// Props passed straight through to every tab's ChatView. The per-tab pieces
// (artifact state, conversation seed/persist, selectedChatId) and the one-shot
// seeds are owned by ChatTabsView and handled separately below.
type SharedChatProps = Omit<
  ChatViewProps,
  | 'setShowArtifacts' | 'showArtifacts' | 'setActiveArtifactTab' | 'setArtifactMode'
  | 'setWorkflowCanvasStage' | 'setWorkflowType' | 'setQueryAssumptions'
  | 'initialMessages' | 'onMessagesChange' | 'selectedChatId' | 'onChatLoaded'
  | 'initialQuery' | 'onInitialQueryProcessed' | 'workflowRunSeed' | 'onWorkflowRunSeedConsumed'
  | 'composerDraft' | 'onComposerDraftConsumed' | 'workflowBuilderSeedPrompt' | 'onWorkflowBuilderSeedConsumed'
>;

export interface ChatTabsViewProps extends SharedChatProps {
  // Recents/history integration: when this becomes a non-null id, open/focus a tab.
  selectedChatId?: string | null;
  onChatConsumed?: () => void;
  // One-shot seeds — routed to the active tab only.
  initialQuery?: string;
  onInitialQueryProcessed?: () => void;
  workflowRunSeed?: ChatViewProps['workflowRunSeed'];
  onWorkflowRunSeedConsumed?: () => void;
  composerDraft?: string | null;
  onComposerDraftConsumed?: () => void;
  workflowBuilderSeedPrompt?: string | null;
  onWorkflowBuilderSeedConsumed?: () => void;
  // Results-panel action handlers (shared across tabs). Optional so a bare
  // fallback render (App's default case) can mount the chat with no wiring.
  onManageExceptions?: () => void;
  onAddToReport?: () => void;
  onShareResults?: () => void;
  onOpenInKnowledgeHub?: () => void;
  onComposeInChat?: (draft: string) => void;
}

function convoToMessages(chatId: string): ChatMessage[] {
  const convo = CHAT_CONVERSATIONS[chatId];
  if (!convo) return [];
  return convo.map((m, idx) => ({
    id: `history-${chatId}-${idx}`,
    role: m.role,
    text: m.text,
    timestamp: new Date(),
  }));
}

function deriveTitle(messages: ChatMessage[] | undefined, fallback: string): string {
  const first = messages?.find((m) => m.role === 'user')?.text?.trim();
  if (!first) return fallback;
  return first.length > 32 ? first.slice(0, 30).trimEnd() + '…' : first;
}

export default function ChatTabsView({
  selectedChatId,
  onChatConsumed,
  initialQuery,
  onInitialQueryProcessed,
  workflowRunSeed,
  onWorkflowRunSeedConsumed,
  composerDraft,
  onComposerDraftConsumed,
  workflowBuilderSeedPrompt,
  onWorkflowBuilderSeedConsumed,
  onManageExceptions = () => {},
  onAddToReport = () => {},
  onShareResults = () => {},
  onOpenInKnowledgeHub = () => {},
  onComposeInChat = () => {},
  ...sharedChatProps
}: ChatTabsViewProps) {
  // Compute the starting tabs + active id + seeded conversations exactly once
  // (restored from storage, or a single fresh "New chat" tab). Held in state so
  // everything is read cleanly during render — no render-time ref access.
  const [boot] = useState(() => {
    const persisted = readTabsState();
    let tabs0: PersistedTab[];
    let activeId0: string;
    if (persisted && persisted.tabs.length > 0) {
      tabs0 = persisted.tabs;
      activeId0 =
        persisted.activeId && persisted.tabs.some((t) => t.id === persisted.activeId)
          ? (persisted.activeId as string)
          : persisted.tabs[0].id;
    } else {
      const id = genTabId();
      tabs0 = [{ id, chatId: null, title: 'New chat' }];
      activeId0 = id;
    }
    const initialMessages: Record<string, ChatMessage[]> = {};
    for (const t of tabs0) {
      initialMessages[t.id] = readTabMessages(t.id) ?? (t.chatId ? convoToMessages(t.chatId) : []);
    }
    return { tabs: tabs0, activeId: activeId0, initialMessages };
  });

  const [tabs, setTabs] = useState<PersistedTab[]>(boot.tabs);
  const [activeId, setActiveId] = useState<string>(boot.activeId);
  // Per-tab seed conversation — ChatView lazy-inits from this on mount.
  const [initialMessagesByTab, setInitialMessagesByTab] = useState<Record<string, ChatMessage[]>>(boot.initialMessages);
  const [artifactByTab, setArtifactByTab] = useState<Record<string, ArtifactState>>({});
  const [titles, setTitles] = useState<Record<string, string>>({});
  const messagesRef = useRef<Record<string, ChatMessage[]>>({});
  const tabsRef = useRef(tabs);
  useEffect(() => { tabsRef.current = tabs; }, [tabs]);

  // Results-panel resize — single shared width, persisted to localStorage.
  const splitRef = useRef<HTMLDivElement>(null);
  const [artifactPanelPx, setArtifactPanelPx] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('artifact-panel-px');
      const n = raw ? parseFloat(raw) : 464;
      return Number.isFinite(n) && n >= 360 ? n : 464;
    } catch { return 464; }
  });
  useEffect(() => {
    try { localStorage.setItem('artifact-panel-px', String(artifactPanelPx)); } catch { /* ignore */ }
  }, [artifactPanelPx]);
  const startSplitDrag = useCallback((e: MouseEvent) => {
    e.preventDefault();
    const containerW = splitRef.current?.offsetWidth ?? 1;
    const startX = e.clientX;
    const startWidth = artifactPanelPx;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    const onMove = (ev: globalThis.MouseEvent) => {
      const delta = ev.clientX - startX;
      const maxPx = Math.max(360, containerW - 480);
      setArtifactPanelPx(Math.max(360, Math.min(maxPx, startWidth - delta)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [artifactPanelPx]);

  const getArtifact = (id: string): ArtifactState => artifactByTab[id] ?? DEFAULT_ARTIFACT;
  const patchArtifact = useCallback((id: string, patch: Partial<ArtifactState>) => {
    setArtifactByTab((prev) => ({ ...prev, [id]: { ...(prev[id] ?? DEFAULT_ARTIFACT), ...patch } }));
  }, []);

  // Persist the tab list + active id whenever they change.
  useEffect(() => {
    writeTabsState({
      tabs: tabs.map((t) => ({ id: t.id, chatId: t.chatId, title: titles[t.id] ?? t.title })),
      activeId: activeId || (tabs[0]?.id ?? null),
    });
  }, [tabs, activeId, titles]);

  const openNewTab = useCallback(() => {
    const id = genTabId();
    setInitialMessagesByTab((prev) => ({ ...prev, [id]: [] }));
    setTabs((prev) => [...prev, { id, chatId: null, title: 'New chat' }]);
    setActiveId(id);
  }, []);

  const openChatTab = useCallback((chatId: string) => {
    const existing = tabsRef.current.find((t) => t.chatId === chatId);
    if (existing) {
      setActiveId(existing.id);
      return;
    }
    const id = genTabId();
    const msgs = convoToMessages(chatId);
    setInitialMessagesByTab((prev) => ({ ...prev, [id]: msgs }));
    const title = CHAT_HISTORY.find((c) => c.id === chatId)?.title ?? deriveTitle(msgs, 'Chat');
    setTabs((prev) => [...prev, { id, chatId, title }]);
    setActiveId(id);
  }, []);

  const closeTab = useCallback((id: string) => {
    clearTabMessages(id);
    delete messagesRef.current[id];
    const cur = tabsRef.current;
    const idx = cur.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const next = cur.filter((t) => t.id !== id);
    if (next.length === 0) {
      // Never reach zero tabs — leave a single fresh "New chat".
      const nid = genTabId();
      setInitialMessagesByTab({ [nid]: [] });
      setTabs([{ id: nid, chatId: null, title: 'New chat' }]);
      setActiveId(nid);
      return;
    }
    setInitialMessagesByTab((prev) => { const n = { ...prev }; delete n[id]; return n; });
    setTabs(next);
    // If the closed tab was active, activate a neighbor (right, else left).
    setActiveId((active) => (active !== id ? active : next[Math.min(idx, next.length - 1)].id));
  }, []);

  // Recents/history → open (or focus) a tab, then clear the app-level signal.
  useEffect(() => {
    if (!selectedChatId) return;
    openChatTab(selectedChatId);
    onChatConsumed?.();
  }, [selectedChatId, openChatTab, onChatConsumed]);

  // Per-tab message reporting: persist the conversation + keep the strip title live.
  const handleTabMessages = useCallback((tabId: string, msgs: ChatMessage[]) => {
    messagesRef.current[tabId] = msgs;
    writeTabMessages(tabId, msgs);
    const cached = tabsRef.current.find((t) => t.id === tabId);
    const next = deriveTitle(msgs, cached?.chatId ? cached.title || 'Chat' : 'New chat');
    setTitles((prev) => (prev[tabId] === next ? prev : { ...prev, [tabId]: next }));
  }, []);

  // Stable per-tab callback bundles (recreated only when the tab set changes).
  const tabApis = useMemo(() => {
    const map: Record<string, {
      setShowArtifacts: (v: boolean) => void;
      setActiveArtifactTab: (t: ArtifactTab) => void;
      setArtifactMode: (m: 'query' | 'workflow') => void;
      setWorkflowType: (t: WorkflowTypeId | null) => void;
      setWorkflowCanvasStage: (s: number) => void;
      setQueryAssumptions: (a: string[]) => void;
      onMessagesChange: (msgs: ChatMessage[]) => void;
    }> = {};
    for (const t of tabs) {
      const id = t.id;
      map[id] = {
        setShowArtifacts: (v) => patchArtifact(id, { showArtifacts: v }),
        setActiveArtifactTab: (tab) => patchArtifact(id, { activeArtifactTab: tab }),
        setArtifactMode: (m) => patchArtifact(id, { artifactMode: m }),
        setWorkflowType: (type) => patchArtifact(id, { workflowType: type }),
        setWorkflowCanvasStage: (s) => patchArtifact(id, { workflowCanvasStage: s }),
        setQueryAssumptions: (a) => patchArtifact(id, { queryAssumptions: a }),
        onMessagesChange: (msgs) => handleTabMessages(id, msgs),
      };
    }
    return map;
  }, [tabs, patchArtifact, handleTabMessages]);

  const active = getArtifact(activeId);
  const activeApi = tabApis[activeId];

  const renderActivePanel = () => {
    if (!active.showArtifacts || !activeApi) return null;
    const inner = active.artifactMode === 'workflow' ? (
      <ChatWorkflowWorkspace onClose={() => activeApi.setShowArtifacts(false)} workflowType={active.workflowType ?? undefined} />
    ) : (
      <ArtifactPanel
        activeTab={active.activeArtifactTab}
        setActiveTab={activeApi.setActiveArtifactTab}
        onClose={() => activeApi.setShowArtifacts(false)}
        onManageExceptions={onManageExceptions}
        onAddToReport={onAddToReport}
        onShareResults={onShareResults}
        onOpenInKnowledgeHub={onOpenInKnowledgeHub}
        onComposeInChat={onComposeInChat}
      />
    );
    return (
      <div style={{ perspective: '1400px' }} className="h-full w-full min-w-0">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active.artifactMode}
            initial={{ rotateY: 0 }}
            animate={{ rotateY: 360 }}
            exit={{ rotateY: 360 }}
            transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
            style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
            className="h-full w-full"
          >
            {inner}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden">
      {/* ── Tab strip ── */}
      <div className="shrink-0 flex items-stretch gap-1 px-2 pt-1.5 bg-canvas border-b border-canvas-border overflow-x-auto">
        {tabs.map((t) => {
          const isActive = t.id === activeId;
          const label = titles[t.id] ?? t.title ?? 'New chat';
          return (
            <div
              key={t.id}
              onClick={() => setActiveId(t.id)}
              title={label}
              className={[
                'group relative flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-t-lg cursor-pointer select-none max-w-[200px] shrink-0 transition-colors',
                isActive
                  ? 'bg-canvas-elevated border border-b-0 border-canvas-border text-ink-900'
                  : 'text-ink-500 hover:bg-canvas-elevated/60 hover:text-ink-700',
              ].join(' ')}
            >
              <span className="truncate text-[0.8125rem] font-medium">{label}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); closeTab(t.id); }}
                aria-label={`Close ${label}`}
                className="shrink-0 inline-flex items-center justify-center size-5 rounded-md text-ink-400 hover:bg-brand-50 hover:text-ink-700 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none"
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={openNewTab}
          aria-label="New chat tab"
          title="New chat"
          className="shrink-0 inline-flex items-center justify-center size-8 my-0.5 rounded-lg text-ink-500 hover:bg-brand-50 hover:text-ink-800 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* ── Split: active chat + its results panel ── */}
      <div ref={splitRef} className="flex flex-1 min-h-0 overflow-hidden">
        <div className="relative h-full min-w-0" style={{ flex: '1 1 0%' }}>
          {tabs.map((t) => {
            const isActive = t.id === activeId;
            const api = tabApis[t.id];
            const art = getArtifact(t.id);
            return (
              <div
                key={t.id}
                className="absolute inset-0"
                style={{ display: isActive ? 'block' : 'none' }}
                aria-hidden={!isActive}
              >
                <ChatView
                  {...(sharedChatProps as SharedChatProps)}
                  initialMessages={initialMessagesByTab[t.id] ?? []}
                  onMessagesChange={api?.onMessagesChange}
                  selectedChatId={undefined}
                  showArtifacts={art.showArtifacts}
                  setShowArtifacts={api?.setShowArtifacts ?? (() => {})}
                  setActiveArtifactTab={api?.setActiveArtifactTab ?? (() => {})}
                  setArtifactMode={api?.setArtifactMode ?? (() => {})}
                  setWorkflowType={api?.setWorkflowType}
                  setWorkflowCanvasStage={api?.setWorkflowCanvasStage}
                  setQueryAssumptions={api?.setQueryAssumptions}
                  initialQuery={isActive ? initialQuery : undefined}
                  onInitialQueryProcessed={isActive ? onInitialQueryProcessed : undefined}
                  workflowRunSeed={isActive ? workflowRunSeed : null}
                  onWorkflowRunSeedConsumed={isActive ? onWorkflowRunSeedConsumed : undefined}
                  composerDraft={isActive ? composerDraft : null}
                  onComposerDraftConsumed={isActive ? onComposerDraftConsumed : undefined}
                  workflowBuilderSeedPrompt={isActive ? workflowBuilderSeedPrompt : null}
                  onWorkflowBuilderSeedConsumed={isActive ? onWorkflowBuilderSeedConsumed : undefined}
                />
              </div>
            );
          })}
        </div>

        {active.showArtifacts && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize chat / Workspace"
            onMouseDown={startSplitDrag}
            className="group relative w-px shrink-0 cursor-col-resize bg-canvas-border z-10"
          >
            <span className="absolute inset-y-0 -left-1.5 -right-1.5" />
            <span aria-hidden="true" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-10 rounded-full bg-canvas-border group-hover:bg-brand-300 transition-colors" />
          </div>
        )}
        {active.showArtifacts && (
          <div className="h-full min-w-0" style={{ width: `${artifactPanelPx}px`, flex: '0 0 auto' }}>
            {renderActivePanel()}
          </div>
        )}
      </div>
    </div>
  );
}
