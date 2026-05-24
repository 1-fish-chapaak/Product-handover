import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { X, Search, Check, Plus, Sparkles, Workflow as WorkflowIcon } from 'lucide-react';
import { LIBRARY_WORKFLOWS, type LibraryWorkflow } from '../workflow/WorkflowLibraryView';

interface Props {
  engagementName: string;
  /** Library workflow ids already linked to this engagement (hidden from the picker). */
  alreadyLinkedIds?: string[];
  onClose: () => void;
  onLink: (workflows: LibraryWorkflow[]) => void;
  onCreateNew: () => void;
}

/**
 * Link Workflow modal — multi-select existing catalog workflows to attach to an
 * engagement, or jump into the Ask IRA builder to create a brand-new one.
 */
export default function LinkWorkflowModal({ engagementName, alreadyLinkedIds = [], onClose, onLink, onCreateNew }: Props) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const linkedSet = useMemo(() => new Set(alreadyLinkedIds), [alreadyLinkedIds]);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    return LIBRARY_WORKFLOWS.filter(w => {
      if (linkedSet.has(w.id)) return false;
      if (!q) return true;
      return w.name.toLowerCase().includes(q)
        || w.businessProcess.toLowerCase().includes(q)
        || w.controlId.toLowerCase().includes(q)
        || w.tags.some(t => t.toLowerCase().includes(q));
    });
  }, [search, linkedSet]);

  const toggle = (id: string) => setSelected(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const handleLink = () => {
    const picked = LIBRARY_WORKFLOWS.filter(w => selected.has(w.id));
    if (picked.length === 0) return;
    onLink(picked);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[560px] max-h-[80vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-border-light">
          <div>
            <h2 className="text-[16px] font-bold text-text">Link Workflows</h2>
            <p className="text-[12.5px] text-text-secondary mt-0.5">
              Attach existing workflows to <span className="font-semibold text-text">{engagementName}</span>, or build a new one.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Create new — primary alternative path */}
        <div className="px-6 pt-4">
          <button
            onClick={onCreateNew}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-primary/20 bg-primary-xlight/40 hover:bg-primary/10 transition-colors cursor-pointer text-left group"
          >
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-primary-medium shrink-0">
              <Sparkles size={16} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-semibold text-text">Create a new workflow</div>
              <div className="text-[11.5px] text-text-secondary mt-0.5">Build one from scratch with Ask IRA — opens the workflow builder chat.</div>
            </div>
            <Plus size={16} className="text-primary shrink-0 group-hover:scale-110 transition-transform" />
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-border-light" />
            <span className="text-[10.5px] uppercase tracking-wider font-semibold text-text-muted">or link from catalog</span>
            <div className="flex-1 h-px bg-border-light" />
          </div>
        </div>

        {/* Search */}
        <div className="px-6">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search workflows by name, process, or control…"
              className="w-full pl-9 pr-3 py-2.5 text-[13px] border border-border rounded-lg bg-white text-text placeholder:text-text-muted outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </div>
        </div>

        {/* Catalog list */}
        <div className="flex-1 overflow-y-auto px-6 py-3 min-h-[160px]">
          {results.length === 0 ? (
            <div className="py-10 text-center text-[12.5px] text-text-muted">
              {search.trim() ? `No workflows match “${search}”.` : 'All catalog workflows are already linked.'}
            </div>
          ) : (
            <div className="space-y-1.5">
              {results.map(w => {
                const checked = selected.has(w.id);
                return (
                  <button
                    key={w.id}
                    onClick={() => toggle(w.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      checked ? 'border-primary/40 bg-primary-xlight/40' : 'border-border-light hover:border-primary/20 hover:bg-surface-2/40'
                    }`}
                  >
                    <span className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 transition-colors ${
                      checked ? 'bg-primary border-primary' : 'bg-white border-border'
                    }`}>
                      {checked && <Check size={12} className="text-white" strokeWidth={3} />}
                    </span>
                    <div className="p-1.5 rounded-lg bg-brand-50 shrink-0"><WorkflowIcon size={13} className="text-brand-600" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-text truncate">{w.name}</div>
                      <div className="text-[11px] text-text-muted mt-0.5 flex items-center gap-1.5">
                        <span className="font-mono">{w.controlId}</span>
                        <span className="text-border">·</span>
                        <span>{w.businessProcess}</span>
                        {w.live && (
                          <>
                            <span className="text-border">·</span>
                            <span className="inline-flex items-center gap-1 text-compliant-700 font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-compliant" />Live
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border-light bg-surface-1/40">
          <span className="text-[12px] text-text-secondary">
            <span className="font-semibold text-text">{selected.size}</span> selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border bg-white hover:bg-surface-2 text-[13px] font-semibold text-text-secondary transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleLink}
              disabled={selected.size === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover disabled:bg-text-muted/30 disabled:cursor-not-allowed text-white text-[13px] font-semibold transition-colors cursor-pointer"
            >
              <Plus size={14} />
              Link {selected.size > 0 ? `${selected.size} ` : ''}Workflow{selected.size === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
