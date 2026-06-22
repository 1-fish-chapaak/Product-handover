import type { ExceptionRole } from '../../hooks/useAppState';

// ─── Cross-persona comment notifications ────────────────────────────────────
// The Risk Owner and Auditor share an always-on comment thread on every
// exception. When one persona posts, the case becomes "unread" for the OTHER
// persona — a count of comments they haven't opened yet. We track that here at
// module level (mirroring how `GRC_CASE_DETAILS[id].activityLog` is mutated in
// place); components reflect changes when their owner (ManageExceptionsView)
// bumps a render tick after each mutation.
//
// Only the RECEIVER ever sees the unread badge: the persona who posted does not.
// Each case holds the recipient + how many of their comments are still unread.
const unread: Record<string, { role: ExceptionRole; count: number } | undefined> = {};

/** Record `count` new comment(s) on each case as unread for `recipient` (the
 *  persona who did NOT post). Accumulates so the receiver sees a running total. */
export function markCommentUnread(ids: string[], recipient: ExceptionRole, count = 1): void {
  ids.forEach(id => {
    const cur = unread[id];
    unread[id] = cur && cur.role === recipient
      ? { role: recipient, count: cur.count + count }
      : { role: recipient, count };
  });
}

/** Clear the unread badge for `role` on a case — they've opened and read it. */
export function clearCommentUnread(id: string, role: ExceptionRole): void {
  if (unread[id]?.role === role) unread[id] = undefined;
}

/** How many unread comments `role` has received on this case (0 = none / they
 *  were the author). Only the recipient ever gets a non-zero count. */
export function unreadCommentCount(id: string, role: ExceptionRole): number {
  const u = unread[id];
  return u && u.role === role ? u.count : 0;
}

/** True when `role` has at least one unread comment waiting on this case. */
export function hasUnreadComment(id: string, role: ExceptionRole): boolean {
  return unreadCommentCount(id, role) > 0;
}
