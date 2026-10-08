/**
 * SOP DRAFTS FINISHING IN THE BACKGROUND (7 Oct, SOP extraction rework, stage 5).
 *
 * The 6 Oct call: once the questions are answered and the plan confirmed, the
 * reader should be free to go — "extracting now, we'll notify you when it's
 * ready" — instead of watching a progress bar. So when they leave mid-extraction
 * the draft is handed here: kept for the session, outside any screen, and
 * marked ready when the extraction would have finished. The app-wide notifier
 * (`SopDraftNotifier`) tells them; opening the notification asks the RACM
 * Library to reopen the draft at its Flowchart, with their answers kept.
 *
 * The draft itself is not stored, only what it is built from — the file, the
 * process, the company and the answers. Drafting is deterministic, so reopening
 * draws the same rows the extraction would have.
 *
 * TDZ note: this folder has an import cycle. Nothing here reads another
 * sox-icfr export at module load — no sox-icfr imports at all.
 */

export interface BackgroundSopDraft {
  id: string;
  file: File;
  process: string;
  entity: string;
  answers: Record<string, string>;
  status: 'running' | 'ready';
}

let drafts: BackgroundSopDraft[] = [];
/** The draft a notification asked to open, waiting for the Library to take it. */
let toOpen: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(fn => fn());

export function subscribeSopDrafts(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export const sopDrafts = (): BackgroundSopDraft[] => drafts;

/** Hand a draft over; it is ready after `ms`. Returns its id. */
export function sendSopDraftToBackground(d: Omit<BackgroundSopDraft, 'id' | 'status'>, ms: number): string {
  const id = `sop-draft-${Date.now().toString(36)}`;
  drafts = [...drafts, { ...d, id, status: 'running' }];
  emit();
  window.setTimeout(() => {
    drafts = drafts.map(x => (x.id === id ? { ...x, status: 'ready' } : x));
    emit();
  }, Math.max(0, ms));
  return id;
}

/** A notification was opened: the Library should reopen this draft. */
export function requestOpenSopDraft(id: string): void {
  toOpen = id;
  emit();
  window.dispatchEvent(new CustomEvent('irame:open-sop-draft'));
}

/** Taken once by whoever opens it, and removed from the session list. */
export function takeSopDraftToOpen(): BackgroundSopDraft | undefined {
  if (!toOpen) return undefined;
  const d = drafts.find(x => x.id === toOpen && x.status === 'ready');
  toOpen = null;
  if (d) drafts = drafts.filter(x => x.id !== d.id);
  return d;
}
