// ─── ATR review layer: comments + version history ───
// Lightweight per-report persistence (localStorage) so review comments and the
// draft→final version trail survive reloads in the prototype.

export interface AtrComment {
  id: string;
  author: string;
  text: string;
  at: string;            // display timestamp
  ts?: number;           // epoch ms — drives relative time + date bucketing
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
  /** Human-readable list of what changed in this version vs the previous one. */
  changes?: string[];
}

const CKEY = (id: string) => `irame.atr.comments.${id}`;
// `.v2` namespace: supersedes the pre-change-log trail so stale generic
// "Finalized" entries are replaced by the seeded, diff-aware history below.
const VKEY = (id: string) => `irame.atr.versions.v2.${id}`;

function read<T>(key: string): T | null {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
}
function write<T>(key: string, val: T) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore quota */ }
}

const fmtStamp = (d: Date) =>
  `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
export const nowStamp = () => fmtStamp(new Date());
// A believable past timestamp for seeded history, N days before today.
const daysAgo = (n: number, hh: number, mm: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hh, mm, 0, 0);
  return fmtStamp(d);
};

// ─── Comments ───
export function loadComments(id: string): AtrComment[] {
  return read<AtrComment[]>(CKEY(id)) ?? [];
}
export function saveComments(id: string, list: AtrComment[]) {
  write(CKEY(id), list);
}

// ─── Versions ───
export interface VersionSeed {
  status: AtrVersionStatus;
  by: string;                  // report author (preparedBy)
  at: string;                  // the report's own latest timestamp
  reviewedBy?: string;
  observations?: string[];     // observation titles, used to write a real change log
}

// Builds the initial version history the first time an ATR is opened. When we
// know the report's observations we lay down a believable authored trail with a
// per-version change log; otherwise we fall back to a single baseline entry.
function seedTrail(seed: VersionSeed): AtrVersion[] {
  const obs = (seed.observations ?? []).map(t => (t ?? '').trim()).filter(Boolean);
  const author = seed.by || 'You';
  const reviewer = seed.reviewedBy || author;
  const clip = (s: string, n = 24) => (s.length > n ? `${s.slice(0, n)}…` : s);
  const label = (i: number) => (obs[i] ? `“${clip(obs[i])}”` : `observation ${i + 1}`);
  const finalStatus: AtrVersionStatus = seed.status === 'frozen' ? 'frozen' : 'final';

  if (obs.length === 0) {
    return [{ version: 1, label: 'Initial draft', status: seed.status, at: seed.at, by: author }];
  }
  return [
    { version: 1, label: 'Initial draft', status: 'draft', at: daysAgo(12, 9, 14), by: author },
    { version: 2, label: 'Drafted observations', status: 'draft', at: daysAgo(9, 15, 33), by: author,
      changes: obs.slice(0, 3).map(t => `Added observation “${clip(t)}”`) },
    { version: 3, label: 'Added action plans', status: 'draft', at: daysAgo(6, 11, 8), by: author,
      changes: [`OBS-01 ${label(0)}: added 1 action plan`, ...(obs[1] ? [`OBS-02 ${label(1)}: added 1 action plan`] : [])] },
    { version: 4, label: 'Updated remediation status', status: 'draft', at: daysAgo(3, 16, 45), by: reviewer,
      changes: [`OBS-01 ${label(0)}: status Open → Closed`, ...(obs[1] ? [`OBS-02 ${label(1)}: status Open → In Progress`] : [])] },
    { version: 5, label: 'Finalized report', status: finalStatus, at: seed.at, by: reviewer,
      changes: ['Edited executive summary', `Reviewed by → ${reviewer}`] },
  ];
}

export function loadVersions(id: string, seed: VersionSeed): AtrVersion[] {
  const existing = read<AtrVersion[]>(VKEY(id));
  if (existing && existing.length) return existing;
  const trail = seedTrail(seed);
  write(VKEY(id), trail);
  return trail;
}

// Like loadVersions, but seeds a SINGLE real baseline (v1 = the generated
// report) instead of the demo trail — so the version history is nothing but
// real user actions from there on. Used by the section-driven reports.
export function loadBaselineVersions(id: string, baseline: { by: string; at: string; label?: string }): AtrVersion[] {
  const existing = read<AtrVersion[]>(VKEY(id));
  if (existing && existing.length) return existing;
  const trail: AtrVersion[] = [{
    version: 1,
    label: baseline.label ?? 'Report generated',
    status: 'draft',
    at: baseline.at || nowStamp(),
    by: baseline.by || 'You',
  }];
  write(VKEY(id), trail);
  return trail;
}
// Current (latest) version number for list surfaces — reads the stored trail if
// present, else computes the seeded trail WITHOUT persisting (no render-time
// side effects), so it matches what the review drawer shows.
export function currentVersion(id: string, seed: VersionSeed): number {
  const existing = read<AtrVersion[]>(VKEY(id));
  const list = existing && existing.length ? existing : seedTrail(seed);
  return list[list.length - 1]?.version ?? 1;
}

/** What version a document is on right now, without seeding a trail for one
 *  that has none. A document with no stored history is on v1 — the same thing
 *  loadBaselineVersions would write the first time it is opened. Read-only, so
 *  a list can print it without writing history for every row it draws. */
export function peekVersion(id: string): number {
  const existing = read<AtrVersion[]>(VKEY(id));
  return existing && existing.length ? existing[existing.length - 1].version : 1;
}
export function saveVersions(id: string, list: AtrVersion[]) {
  write(VKEY(id), list);
}
export function appendVersion(id: string, list: AtrVersion[], label: string, status: AtrVersionStatus, by: string, changes?: string[]): AtrVersion[] {
  const next: AtrVersion = { version: (list[list.length - 1]?.version ?? 0) + 1, label: label.trim() || `Version ${list.length + 1}`, status, at: nowStamp(), by, changes: changes?.length ? changes : undefined };
  const updated = [...list, next];
  write(VKEY(id), updated);
  return updated;
}
