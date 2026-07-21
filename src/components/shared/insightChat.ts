// ─── Open a recommendation / follow-up in Ask IRA ──────────────────────────
// Insight cards and the recommendations panel both send a step into the chat.
// The app reads ?view=chat&prompt=… on boot and pre-fills the composer (not
// auto-submitted — the auditor edits and sends it). Opens in a new tab.

export function openInChat(ask: string, subjectLabel?: string): void {
  const prompt = subjectLabel ? `${ask}\n\n(regarding ${subjectLabel})` : ask;
  try {
    window.open(`?view=chat&prompt=${encodeURIComponent(prompt)}`, '_blank', 'noopener,noreferrer');
  } catch {
    /* ignore — popup blocked */
  }
}
