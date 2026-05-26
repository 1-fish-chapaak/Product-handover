// Bookmarked chat messages — persisted in localStorage so a Bookmark from
// the chat surface lands in Recents · Favourites. Mock-only (no backend);
// the storage key is intentionally versioned so a future schema change can
// migrate cleanly.

export const BOOKMARKED_MESSAGES_KEY = 'chat.bookmarkedMessages.v1';

export interface BookmarkedMessage {
  /** The original chat message id — used as the bookmark's unique key. */
  msgId: string;
  /** Chat thread id if known. Null for bookmarks added inside an unsaved (new) chat. */
  chatId: string | null;
  /** Chat title at the time of bookmark — used as the secondary label in Favourites. */
  chatTitle: string;
  /** The bookmarked message body. */
  text: string;
  /** ISO timestamp of when the bookmark was created (not when the message was sent). */
  timestamp: string;
}

export function readBookmarkedMessages(): BookmarkedMessage[] {
  try {
    const raw = localStorage.getItem(BOOKMARKED_MESSAGES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((b): b is BookmarkedMessage =>
      !!b && typeof b === 'object' &&
      typeof (b as BookmarkedMessage).msgId === 'string' &&
      typeof (b as BookmarkedMessage).text === 'string',
    );
  } catch {
    return [];
  }
}

export function writeBookmarkedMessages(bookmarks: BookmarkedMessage[]): void {
  try {
    localStorage.setItem(BOOKMARKED_MESSAGES_KEY, JSON.stringify(bookmarks));
    // Same-window listeners (e.g. RecentsView) won't get the native `storage`
    // event (that only fires in OTHER tabs). Dispatch a synthetic event so a
    // mounted RecentsView refreshes when a bookmark is toggled from the chat.
    window.dispatchEvent(new CustomEvent('chat-bookmarks-updated'));
  } catch {
    /* swallow — localStorage may be unavailable in private mode */
  }
}
