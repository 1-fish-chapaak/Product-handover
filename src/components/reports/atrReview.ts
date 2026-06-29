// ─── ATR review layer: comments + version history ───
// Lightweight per-report persistence (localStorage) so review comments and the
// draft→final version trail survive reloads in the prototype.

export interface AtrComment {
  id: string;
  author: string;
  text: string;
  at: string;            // display timestamp
  section?: string;      // optional section label the comment is anchored to
  resolved?: boolean;
}

export type AtrVersionStatus = 'draft' | 'final' | 'frozen';
export interface AtrVersion {
  version: number;
  label: string;
  status: AtrVersionStatus;
  at: string;
  by: string;
}

const CKEY = (id: string) => `irame.atr.comments.${id}`;
const VKEY = (id: string) => `irame.atr.versions.${id}`;

function read<T>(key: string): T | null {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
}
function write<T>(key: string, val: T) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore quota */ }
}

export const nowStamp = () => {
  const d = new Date();
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
};

// ─── Comments ───
export function loadComments(id: string): AtrComment[] {
  return read<AtrComment[]>(CKEY(id)) ?? [];
}
export function saveComments(id: string, list: AtrComment[]) {
  write(CKEY(id), list);
}

// ─── Versions ───
// Seeds a v1 entry from the report's own status the first time it's opened, so
// every ATR has a baseline version trail.
export function loadVersions(id: string, seed: { status: AtrVersionStatus; by: string; at: string }): AtrVersion[] {
  const existing = read<AtrVersion[]>(VKEY(id));
  if (existing && existing.length) return existing;
  const v1: AtrVersion[] = [{ version: 1, label: seed.status === 'frozen' ? 'Final · frozen' : 'Initial draft', status: seed.status, at: seed.at, by: seed.by }];
  write(VKEY(id), v1);
  return v1;
}
export function saveVersions(id: string, list: AtrVersion[]) {
  write(VKEY(id), list);
}
export function appendVersion(id: string, list: AtrVersion[], label: string, status: AtrVersionStatus, by: string): AtrVersion[] {
  const next: AtrVersion = { version: (list[list.length - 1]?.version ?? 0) + 1, label: label.trim() || `Version ${list.length + 1}`, status, at: nowStamp(), by };
  const updated = [...list, next];
  write(VKEY(id), updated);
  return updated;
}
