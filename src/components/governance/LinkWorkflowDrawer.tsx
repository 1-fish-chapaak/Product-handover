import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { X, Search, Check, Link2, Workflow } from 'lucide-react';
import { WORKFLOWS } from '../../data/mockData';

const BP_LABELS: Record<string, string> = {
  p2p: 'P2P', o2c: 'O2C', r2r: 'R2R', itgc: 'ITGC', s2c: 'S2C',
};

interface Props {
  onClose: () => void;
  onLink: (workflowId: string, workflowName: string) => void;
  alreadyLinkedIds: string[];
}

export default function LinkWorkflowDrawer({ onClose, onLink, alreadyLinkedIds }: Props) {
  const [search, setSearch] = useState('');
  const [bpFilter, setBpFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const available = useMemo(() => {
    return WORKFLOWS.filter(w => !alreadyLinkedIds.includes(w.id));
  }, [alreadyLinkedIds]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return available.filter(w => {
      if (bpFilter !== 'all' && w.bpId !== bpFilter) return false;
      if (q && !w.name.toLowerCase().includes(q) && !w.desc.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [available, search, bpFilter]);

  const selectedWf = WORKFLOWS.find(w => w.id === selectedId);

  return (
    <>
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <motion.aside
        initial={{ x: 24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-[520px] bg-canvas-elevated shadow-xl border-l border-canvas-border flex flex-col z-50"
        role="dialog"
        aria-label="Link Workflow"
      >
        {/* Header */}
        <header className="shrink-0 px-6 pt-5 pb-4 border-b border-canvas-border">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Link2 size={18} className="text-brand-600" />
                <h2 className="text-[1.25rem] font-semibold text-ink-900 tracking-tight">Link Workflow</h2>
              </div>
              <p className="text-[0.75rem] text-ink-500 mt-0.5">Select a workflow from the Workflow Library to link to this control.</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* Filters */}
        <div className="px-6 py-4 border-b border-canvas-border space-y-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search workflows..."
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-canvas-border bg-white text-[0.8125rem] text-ink-800 placeholder:text-ink-400 outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10 transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[0.6875rem] font-semibold text-ink-500">Process:</span>
            {['all', 'p2p', 'o2c', 'r2r', 's2c'].map(bp => (
              <button
                key={bp}
                onClick={() => setBpFilter(bp)}
                className={`px-2.5 py-1 rounded-full text-[0.6875rem] font-semibold transition-all cursor-pointer ${
                  bpFilter === bp
                    ? 'bg-brand-600 text-white'
                    : 'bg-canvas text-ink-500 hover:bg-brand-50 hover:text-brand-700'
                }`}
              >
                {bp === 'all' ? 'All' : BP_LABELS[bp] || bp.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Workflow list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <Workflow size={24} className="mx-auto text-ink-400 mb-2" />
              <p className="text-[0.8125rem] text-ink-500">No workflows available</p>
              <p className="text-[0.75rem] text-ink-400 mt-0.5">All workflows are already linked or no matches found.</p>
            </div>
          ) : (
            filtered.map(wf => {
              const selected = selectedId === wf.id;
              return (
                <button
                  key={wf.id}
                  onClick={() => setSelectedId(selected ? null : wf.id)}
                  className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all cursor-pointer ${
                    selected
                      ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20'
                      : 'border-canvas-border bg-white hover:bg-canvas'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                      selected ? 'border-brand-600 bg-brand-600' : 'border-canvas-border'
                    }`}>
                      {selected && <Check size={11} className="text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[0.8125rem] font-semibold text-ink-800">{wf.name}</span>
                        <span className="px-1.5 py-0.5 rounded text-[0.625rem] font-bold bg-evidence-50 text-evidence-700 uppercase">{wf.type}</span>
                      </div>
                      <p className="text-[0.75rem] text-ink-500 line-clamp-2">{wf.desc}</p>
                      <div className="flex items-center gap-4 mt-2 text-[0.6875rem] text-ink-400">
                        <span>{BP_LABELS[wf.bpId] || wf.bpId.toUpperCase()}</span>
                        <span>{wf.steps.length} steps</span>
                        <span>{wf.runs} runs</span>
                        <span>Last: {wf.lastRun}</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <footer className="shrink-0 px-6 py-4 border-t border-canvas-border bg-canvas flex items-center justify-between">
          <div className="text-[0.75rem] text-ink-400">
            {available.length} workflow{available.length !== 1 ? 's' : ''} available
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-canvas-border text-[0.8125rem] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => { if (selectedWf) onLink(selectedWf.id, selectedWf.name); }}
              disabled={!selectedId}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Link2 size={14} />
              Link Workflow
            </button>
          </div>
        </footer>
      </motion.aside>
    </>
  );
}
