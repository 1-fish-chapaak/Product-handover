import { useState } from 'react';
import { motion } from 'motion/react';
import { X, MessageSquare, GitBranch, Send, CheckCircle2, Plus, FileText, Lock } from 'lucide-react';
import {
  type AtrComment, type AtrVersion, type AtrVersionStatus,
  loadComments, saveComments, appendVersion, saveVersions, nowStamp,
} from './atrReview';

const STATUS_PILL: Record<AtrVersionStatus, string> = {
  draft: 'bg-draft-50 text-draft-700 border-draft/30',
  final: 'bg-compliant-50 text-compliant-700 border-compliant/30',
  frozen: 'bg-brand-50 text-brand-700 border-brand-200',
};

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
  const [versionLabel, setVersionLabel] = useState('');

  const addComment = () => {
    if (!draft.trim()) return;
    const next: AtrComment = { id: `c-${Date.now()}`, author: me, text: draft.trim(), at: nowStamp() };
    const updated = [...comments, next];
    setComments(updated); saveComments(reportId, updated); setDraft('');
  };
  const toggleResolve = (id: string) => {
    const updated = comments.map(c => c.id === id ? { ...c, resolved: !c.resolved } : c);
    setComments(updated); saveComments(reportId, updated);
  };
  const addVersion = (status: AtrVersionStatus) => {
    const updated = appendVersion(reportId, versions, versionLabel || (status === 'frozen' ? 'Finalized' : 'Revised draft'), status, me);
    setVersions(updated); saveVersions(reportId, updated); setVersionLabel('');
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="fixed inset-0 bg-ink-900/30 z-[60] print:hidden" onClick={onClose} />
      <motion.aside
        initial={{ x: 380 }} animate={{ x: 0 }} exit={{ x: 380 }} transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
        className="fixed right-0 top-0 bottom-0 w-[380px] max-w-[92vw] bg-canvas-elevated border-l border-canvas-border z-[65] flex flex-col print:hidden"
        role="dialog" aria-label="ATR review"
      >
        <header className="shrink-0 px-4 pt-3.5 pb-0 border-b border-canvas-border">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="min-w-0">
              <div className="text-[0.875rem] font-semibold text-ink-900 truncate">Review</div>
              <div className="text-[0.6875rem] text-ink-500 truncate">{reportName}</div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-draft-50 flex items-center justify-center cursor-pointer shrink-0"><X size={16} /></button>
          </div>
          <div className="flex items-center gap-1">
            {([
              { k: 'comments' as const, icon: MessageSquare, label: `Comments${comments.length ? ` (${comments.length})` : ''}` },
              { k: 'versions' as const, icon: GitBranch, label: `Versions (${versions.length})` },
            ]).map(t => (
              <button key={t.k} onClick={() => onTab(t.k)} className={`inline-flex items-center gap-1.5 h-9 px-3 text-[0.75rem] font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${tab === t.k ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-800'}`}>
                <t.icon size={13} /> {t.label}
              </button>
            ))}
          </div>
        </header>

        {tab === 'comments' ? (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2.5">
              {comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                  <MessageSquare size={22} className="text-ink-300" />
                  <div className="text-[0.8125rem] font-medium text-ink-700">No comments yet</div>
                  <div className="text-[0.6875rem] text-ink-500">Leave the first review note below.</div>
                </div>
              ) : comments.map(c => (
                <div key={c.id} className={`rounded-[10px] border p-3 ${c.resolved ? 'border-canvas-border bg-canvas opacity-70' : 'border-canvas-border bg-canvas'}`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-[0.5625rem] font-bold flex items-center justify-center shrink-0">{c.author.slice(0, 1)}</span>
                      <span className="text-[0.75rem] font-semibold text-ink-800 truncate">{c.author}</span>
                      <span className="text-[0.625rem] text-ink-400 shrink-0">· {c.at}</span>
                    </div>
                    <button onClick={() => toggleResolve(c.id)} title={c.resolved ? 'Reopen' : 'Resolve'} className={`shrink-0 ${c.resolved ? 'text-compliant-700' : 'text-ink-400 hover:text-compliant-700'} cursor-pointer`}><CheckCircle2 size={14} /></button>
                  </div>
                  <p className={`text-[0.75rem] leading-relaxed ${c.resolved ? 'line-through text-ink-400' : 'text-ink-700'}`}>{c.text}</p>
                </div>
              ))}
            </div>
            <div className="shrink-0 border-t border-canvas-border p-3">
              <div className="flex items-end gap-2">
                <textarea value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addComment(); }} rows={2} placeholder="Add a review comment… (⌘↵ to send)" className="flex-1 px-3 py-2 rounded-[8px] border border-canvas-border text-[0.75rem] text-ink-900 resize-none focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15" />
                <button onClick={addComment} disabled={!draft.trim()} className="w-9 h-9 rounded-[8px] bg-brand-600 text-white flex items-center justify-center hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"><Send size={15} /></button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              <ol className="relative border-l border-canvas-border ml-2 space-y-4 py-1">
                {[...versions].reverse().map(v => (
                  <li key={v.version} className="ml-4 relative">
                    <span className="absolute -left-[22px] top-1 w-3 h-3 rounded-full bg-brand-500 ring-4 ring-canvas-elevated" />
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[0.8125rem] font-bold text-ink-900">v{v.version}</span>
                      <span className={`inline-flex items-center gap-1 h-5 px-2 rounded-full border text-[0.5625rem] font-semibold capitalize ${STATUS_PILL[v.status]}`}>{v.status === 'frozen' && <Lock size={9} />}{v.status}</span>
                    </div>
                    <div className="text-[0.75rem] font-medium text-ink-700">{v.label}</div>
                    <div className="text-[0.625rem] text-ink-400">{v.by} · {v.at}</div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="shrink-0 border-t border-canvas-border p-3 space-y-2">
              <input value={versionLabel} onChange={e => setVersionLabel(e.target.value)} placeholder="New version label (optional)" className="w-full h-9 px-3 rounded-[8px] border border-canvas-border text-[0.75rem] text-ink-900 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15" />
              <div className="flex items-center gap-2">
                <button onClick={() => addVersion('draft')} className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 text-[0.75rem] font-semibold text-ink-700 bg-canvas border border-canvas-border rounded-[8px] hover:border-brand-200 cursor-pointer"><Plus size={13} /> Save draft</button>
                <button onClick={() => addVersion('frozen')} className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 text-[0.75rem] font-semibold text-white bg-brand-600 rounded-[8px] hover:bg-brand-500 cursor-pointer"><FileText size={13} /> Finalize</button>
              </div>
            </div>
          </>
        )}
      </motion.aside>
    </>
  );
}
