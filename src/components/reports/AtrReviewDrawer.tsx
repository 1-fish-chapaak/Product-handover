import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, MessageSquare, GitBranch, Send, CheckCircle2, Pencil, Check, History } from 'lucide-react';
import {
  type AtrComment, type AtrVersion,
  loadComments, saveComments, saveVersions, nowStamp,
} from './atrReview';

/** Review side-drawer for a saved ATR — comments + version history. */
export default function AtrReviewDrawer({ reportId, reportName, tab, onClose, onTab, initialVersions, me = 'You' }: {
  reportId: string;
  reportName: string;
  tab: 'comments' | 'versions';
  onClose: () => void;
  onTab: (t: 'comments' | 'versions') => void;
  initialVersions: AtrVersion[];
  me?: string;
}) {
  const [comments, setComments] = useState<AtrComment[]>(() => loadComments(reportId));
  const [versions, setVersions] = useState<AtrVersion[]>(initialVersions);
  const [draft, setDraft] = useState('');
  const [editingVersion, setEditingVersion] = useState<number | null>(null);
  const [labelDraft, setLabelDraft] = useState('');

  // Escape closes the drawer the way it closes every other overlay (shared
  // Modal.tsx), unless a version label is mid-rename — there Escape cancels the
  // rename first. Without this the backdrop stayed up and swallowed every click.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (editingVersion != null) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, editingVersion]);

  const addComment = () => {
    if (!draft.trim()) return;
    const next: AtrComment = { id: `c-${Date.now()}`, author: me, text: draft.trim(), at: nowStamp(), ts: Date.now() };
    const updated = [...comments, next];
    setComments(updated); saveComments(reportId, updated); setDraft('');
  };
  const toggleResolve = (id: string) => {
    const updated = comments.map(c => c.id === id ? { ...c, resolved: !c.resolved } : c);
    setComments(updated); saveComments(reportId, updated);
  };
  const startRename = (v: AtrVersion) => { setEditingVersion(v.version); setLabelDraft(v.label); };
  const commitRename = () => {
    if (editingVersion == null) return;
    const trimmed = labelDraft.trim();
    if (trimmed) {
      const updated = versions.map(v => v.version === editingVersion ? { ...v, label: trimmed } : v);
      setVersions(updated); saveVersions(reportId, updated);
    }
    setEditingVersion(null); setLabelDraft('');
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="fixed inset-0 bg-[rgba(15,8,30,0.78)] backdrop-blur-[6px] z-[60] print:hidden" onClick={onClose} />
      <motion.aside
        initial={{ x: 560 }} animate={{ x: 0 }} exit={{ x: 560 }} transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
        className="fixed right-0 top-0 bottom-0 w-full max-w-[560px] bg-canvas-elevated border-l border-canvas-border z-[65] flex flex-col print:hidden"
        role="dialog" aria-label="Report activity log"
      >
        <header className="shrink-0 px-6 pt-5 border-b border-canvas-border">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-md bg-brand-600/10 text-brand-600 flex items-center justify-center shrink-0">
                <History size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-[1rem] font-semibold text-ink-800 leading-tight">Activity log</h2>
                  {comments.length + versions.length > 0 && (
                    <motion.span
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.15, type: 'spring', stiffness: 520, damping: 24 }}
                      className="inline-flex items-center h-[18px] px-1.5 rounded-full bg-brand-50 text-brand-700 text-[0.625rem] font-semibold tabular-nums"
                    >
                      {comments.length + versions.length}
                    </motion.span>
                  )}
                </div>
                <p className="text-[0.75rem] text-ink-400 mt-0.5 leading-snug truncate" title={reportName}>Comments and version history for <span className="text-ink-600 font-medium">{reportName}</span>.</p>
              </div>
            </div>
            <motion.button
              onClick={onClose}
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
              className="w-8 h-8 rounded-full text-ink-400 hover:text-ink-800 hover:bg-brand-50 flex items-center justify-center cursor-pointer shrink-0"
              aria-label="Close"
            >
              <X size={16} />
            </motion.button>
          </div>
          <div className="flex items-center gap-1">
            {([
              { k: 'comments' as const, icon: MessageSquare, label: 'Comments', count: comments.length },
              { k: 'versions' as const, icon: GitBranch, label: 'Versions', count: versions.length },
            ]).map(t => {
              const active = tab === t.k;
              return (
                <button
                  key={t.k}
                  onClick={() => onTab(t.k)}
                  className={`relative inline-flex items-center gap-1.5 h-10 px-3 text-[0.8125rem] font-semibold transition-colors cursor-pointer ${active ? 'text-brand-700' : 'text-ink-500 hover:text-ink-800'}`}
                >
                  <t.icon size={14} />
                  {t.label}
                  {t.count > 0 && (
                    <span className={`inline-flex items-center justify-center h-[18px] min-w-[18px] px-1 rounded-full text-[0.625rem] font-semibold tabular-nums ${active ? 'bg-brand-50 text-brand-700' : 'bg-draft-50 text-ink-600'}`}>
                      {t.count}
                    </span>
                  )}
                  {active && <motion.span layoutId="reviewTabUnderline" className="absolute left-0 right-0 -bottom-px h-[2px] bg-brand-600 rounded-full" />}
                </button>
              );
            })}
          </div>
        </header>

        {tab === 'comments' ? (
          <>
            {/* Composer — top, mirroring the Report Activity Log. */}
            <section className="shrink-0 px-6 py-4 border-b border-canvas-border bg-canvas">
              <div className="bg-white border border-canvas-border rounded-lg focus-within:border-brand-600/40 focus-within:ring-2 focus-within:ring-brand-600/15 transition-all overflow-hidden">
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); addComment(); } }}
                  rows={3}
                  placeholder="Add a review comment…"
                  className="w-full resize-none bg-transparent border-0 px-3 pt-3 pb-1.5 text-[0.8125rem] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-0"
                />
                <div className="flex items-center justify-end px-2 py-2 border-t border-canvas-border/60">
                  <button
                    onClick={addComment}
                    disabled={!draft.trim()}
                    title="Post comment (⌘↵)"
                    className={`inline-flex items-center gap-1.5 h-8 px-4 text-[0.75rem] font-semibold rounded-md transition-colors ${draft.trim() ? 'bg-brand-600 text-white hover:bg-brand-500 cursor-pointer' : 'bg-brand-600/40 text-white/80 cursor-not-allowed'}`}
                  >
                    <Send size={12} /> Post
                  </button>
                </div>
              </div>
            </section>

            {/* Feed — vertical timeline grouped by date, matching the activity log. */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
              {comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                  <MessageSquare size={22} className="text-ink-300" />
                  <div className="text-[0.8125rem] font-medium text-ink-700">No comments yet</div>
                  <div className="text-[0.6875rem] text-ink-500">Leave the first review note above.</div>
                </div>
              ) : (() => {
                const initials = (name: string) => name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
                // Epoch for a comment — stored `ts`, else parsed from the display stamp.
                const tsOf = (c: AtrComment): number | undefined => {
                  if (c.ts) return c.ts;
                  const p = Date.parse(c.at.replace(',', ''));
                  return Number.isNaN(p) ? undefined : p;
                };
                // Relative label ("5 hours ago"), matching the Report Activity Log.
                const relTime = (c: AtrComment): string => {
                  const ts = tsOf(c);
                  if (!ts) return c.at;
                  const min = Math.max(0, Math.floor((Date.now() - ts) / 60000));
                  if (min < 1) return 'Just now';
                  if (min < 60) return `${min} min ago`;
                  const hr = Math.floor(min / 60);
                  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
                  const day = Math.floor(hr / 24);
                  if (day === 1) return '1 day ago';
                  if (day < 7) return `${day} days ago`;
                  return c.at;
                };
                // Coarse Today / Yesterday / Earlier buckets, ordered newest-first.
                const bucketOf = (c: AtrComment): 'Today' | 'Yesterday' | 'Earlier' => {
                  const ts = tsOf(c);
                  if (!ts) return 'Earlier';
                  const now = new Date(); const d = new Date(ts);
                  if (now.toDateString() === d.toDateString()) return 'Today';
                  const y = new Date(now); y.setDate(now.getDate() - 1);
                  if (y.toDateString() === d.toDateString()) return 'Yesterday';
                  return 'Earlier';
                };
                const sorted = [...comments].reverse();
                const groups = (['Today', 'Yesterday', 'Earlier'] as const)
                  .map(label => ({ label, items: sorted.filter(c => bucketOf(c) === label) }))
                  .filter(g => g.items.length > 0);
                return (
                  <div className="relative">
                    <span aria-hidden className="absolute left-[15px] top-1 bottom-1 w-px bg-canvas-border" />
                    <div className="space-y-6">
                      {groups.map(group => (
                        <section key={group.label}>
                          <div className="flex items-center gap-2.5 mb-3 pl-[46px]">
                            <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400">{group.label}</h3>
                            <div className="flex-1 h-px bg-canvas-border/70" />
                            <span className="text-[0.625rem] tabular-nums text-ink-300">{group.items.length} {group.items.length === 1 ? 'entry' : 'entries'}</span>
                          </div>
                          <ol className="space-y-5">
                            {group.items.map(c => (
                              <li key={c.id} className="group/entry relative flex gap-3.5">
                                <div className="relative z-[1] shrink-0 w-8 h-8 rounded-full bg-brand-600/10 text-brand-700 ring-[3px] ring-canvas-elevated flex items-center justify-center text-[0.625rem] font-semibold tracking-tight">
                                  {initials(c.author)}
                                </div>
                                <div className="flex-1 min-w-0 pb-0.5">
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-[0.8125rem] font-semibold text-ink-800 truncate">{c.author}</span>
                                    <span className="ml-auto text-[0.6875rem] text-ink-400 tabular-nums whitespace-nowrap">{relTime(c)}</span>
                                    <button
                                      onClick={() => toggleResolve(c.id)}
                                      title={c.resolved ? 'Reopen' : 'Resolve'}
                                      aria-label={c.resolved ? 'Reopen comment' : 'Resolve comment'}
                                      className={`shrink-0 transition-opacity cursor-pointer ${c.resolved ? 'text-compliant-700 opacity-100' : 'text-ink-300 hover:text-compliant-700 opacity-0 group-hover/entry:opacity-100 focus-visible:opacity-100'}`}
                                    >
                                      <CheckCircle2 size={14} />
                                    </button>
                                  </div>
                                  <p className={`mt-2 text-[0.8125rem] leading-relaxed ${c.resolved ? 'line-through text-ink-400' : 'text-ink-700'}`}>{c.text}</p>
                                </div>
                              </li>
                            ))}
                          </ol>
                        </section>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
              <div className="relative">
                {/* Continuous spine threading each version node, mirroring the comments feed. */}
                <span aria-hidden className="absolute left-[15px] top-1 bottom-1 w-px bg-canvas-border" />
                <ol className="space-y-5">
                  {[...versions].reverse().map((v, i) => {
                    const isLatest = i === 0;
                    return (
                    <li key={v.version} className="relative flex gap-3.5 group">
                      <div className={`relative z-[1] shrink-0 w-8 h-8 rounded-full ring-[3px] ring-canvas-elevated flex items-center justify-center text-[0.625rem] font-bold tabular-nums ${isLatest ? 'bg-brand-600 text-white' : 'bg-brand-600/10 text-brand-700'}`}>
                        v{v.version}
                      </div>
                      <div className="flex-1 min-w-0 pb-0.5">
                        {editingVersion === v.version ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              autoFocus
                              value={labelDraft}
                              onChange={e => setLabelDraft(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setEditingVersion(null); setLabelDraft(''); } }}
                              className="flex-1 min-w-0 h-8 px-2 rounded-sm border border-brand-600 text-[0.875rem] text-ink-900 focus:outline-none"
                            />
                            <button onClick={commitRename} title="Save name" className="w-8 h-8 rounded-sm bg-brand-600 text-white flex items-center justify-center hover:bg-brand-500 cursor-pointer shrink-0"><Check size={14} /></button>
                            <button onClick={() => { setEditingVersion(null); setLabelDraft(''); }} title="Cancel" className="w-8 h-8 rounded-sm text-ink-500 hover:bg-draft-50 flex items-center justify-center cursor-pointer shrink-0"><X size={14} /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[0.875rem] font-semibold text-ink-800 truncate">{v.label}</span>
                            {isLatest && <span className="shrink-0 inline-flex items-center h-[17px] px-1.5 rounded-full bg-brand-50 text-brand-700 text-[0.5625rem] font-semibold uppercase tracking-wide">Current</span>}
                            <button onClick={() => startRename(v)} title="Rename version" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 w-5 h-5 rounded-sm text-ink-400 hover:text-brand-700 hover:bg-brand-50 flex items-center justify-center cursor-pointer transition-opacity shrink-0"><Pencil size={12} /></button>
                            <span className="ml-auto text-[0.6875rem] text-ink-400 tabular-nums whitespace-nowrap shrink-0">{v.at}</span>
                          </div>
                        )}
                        {v.changes && v.changes.length > 0 && (
                          <ul className="mt-2 space-y-1.5 rounded-md border border-canvas-border bg-canvas px-3 py-2.5">
                            {v.changes.map((c, ci) => (
                              <li key={ci} className="flex gap-2 text-[0.75rem] leading-relaxed text-ink-600">
                                <span className="mt-[7px] w-1 h-1 rounded-full bg-brand-400 shrink-0" />
                                <span className="min-w-0 break-words">{c}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="mt-1.5 text-[0.6875rem] text-ink-400">{v.by}</div>
                      </div>
                    </li>
                    );
                  })}
                </ol>
              </div>
            </div>
            <div className="shrink-0 border-t border-canvas-border px-6 py-3 flex items-start gap-2">
              <GitBranch size={13} className="text-ink-400 mt-0.5 shrink-0" />
              <p className="text-[0.6875rem] leading-relaxed text-ink-500">
                Every save captures a new version with a log of what changed. Hover a version to rename it.
              </p>
            </div>
          </>
        )}
      </motion.aside>
    </>
  );
}
