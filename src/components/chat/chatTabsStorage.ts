import type { ChatMessage } from './ChatView';

// ─── Chat-tabs persistence ───────────────────────────────────────────────────
// The chat surface supports browser-like in-app tabs (one chat per tab). Open
// tabs and each tab's conversation are saved to localStorage so a page reload
// restores them — a deliberate exception to the rest of the prototype, which
// otherwise keeps chats only in memory.

const TABS_KEY = 'irame.chat.tabs.v1';
const msgsKey = (tabId: string) => `irame.chat.tab.${tabId}.msgs.v1`;

export interface PersistedTab {
  id: string;
  /** Saved-conversation id this tab was opened from (Recents/history), else null. */
  chatId: string | null;
  /** Cached title so a restored tab shows a label before its ChatView mounts. */
  title: string;
}

export interface PersistedTabsState {
  tabs: PersistedTab[];
  activeId: string | null;
}

export function readTabsState(): PersistedTabsState | null {
  try {
    const raw = localStorage.getItem(TABS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.tabs)) return null;
    return parsed as PersistedTabsState;
  } catch {
    return null;
  }
}

export function writeTabsState(state: PersistedTabsState): void {
  try {
    localStorage.setItem(TABS_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / serialization errors */
  }
}

export function readTabMessages(tabId: string): ChatMessage[] | null {
  try {
    const raw = localStorage.getItem(msgsKey(tabId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    // Timestamps were serialized to ISO strings — revive them to Date.
    return parsed.map((m: ChatMessage & { timestamp: string | Date }) => ({
      ...m,
      timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
    })) as ChatMessage[];
  } catch {
    return null;
  }
}

export function writeTabMessages(tabId: string, messages: ChatMessage[]): void {
  try {
    localStorage.setItem(msgsKey(tabId), JSON.stringify(messages));
  } catch {
    /* ignore */
  }
}

export function clearTabMessages(tabId: string): void {
  try {
    localStorage.removeItem(msgsKey(tabId));
  } catch {
    /* ignore */
  }
}

let idSeq = 0;
/** Stable-enough unique id for a tab (no Date.now needed). */
export function genTabId(): string {
  idSeq += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `tab-${idSeq}-${rand}`;
}
