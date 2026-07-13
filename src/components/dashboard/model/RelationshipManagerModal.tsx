import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Sparkles, Pencil, Trash2, ArrowLeftRight, Link2, AlertTriangle, Loader2 } from 'lucide-react';
import type { ToastType } from '../../shared/Toast';
import type { ModelTable, Relationship, AutoDetectCandidate, WidgetModelConfig } from './relationshipTypes';
import { tableById, autoDetect, pairHasActive, widgetUsesRelationship } from './joinEngine';
import RelationshipEditor from './RelationshipEditor';
import AutoDetectReview from './AutoDetectReview';

type View = 'list' | 'editor' | 'autodetect';

/** Apply single-active-per-pair: when `saved` is active, deactivate other
 *  relationships covering the same (unordered) table pair. */
function withActiveExclusivity(rels: Relationship[], saved: Relationship): Relationship[] {
  if (!saved.active) return rels;
  const samePair = (r: Relationship) =>
    (r.leftTable === saved.leftTable && r.rightTable === saved.rightTable) ||
    (r.leftTable === saved.rightTable && r.rightTable === saved.leftTable);
  return rels.map(r => (r.id !== saved.id && samePair(r) ? { ...r, active: false } : r));
}

export default function RelationshipManagerModal({
  open, onClose, tables, relationships, setRelationships, widgets, addToast,
}: {
  open: boolean;
  onClose: () => void;
  tables: ModelTable[];
  relationships: Relationship[];
  setRelationships: React.Dispatch<React.SetStateAction<Relationship[]>>;
  widgets: { title: string; model?: WidgetModelConfig }[];
  addToast: (t: { message: string; type: ToastType }) => void;
}) {
  const [view, setView] = useState<View>('list');
  const [editing, setEditing] = useState<Relationship | undefined>(undefined);
  const [candidates, setCandidates] = useState<AutoDetectCandidate[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Relationship | null>(null);

  if (!open) return null;
  const tname = (id: string) => tableById(tables, id)?.name ?? id;
  const clabel = (tid: string, col: string) => tableById(tables, tid)?.columns.find(c => c.name === col)?.label ?? col;

  const INACTIVE_NOTICE = 'An active connection already exists for these tables — this one will be saved as Inactive. You can switch which one is active from the list.';

  const upsert = (rel: Relationship) => {
    const inactiveDueToConflict = !rel.active && pairHasActive(relationships.filter(r => r.id !== rel.id), rel.leftTable, rel.rightTable);
    setRelationships(prev => {
      const exists = prev.some(r => r.id === rel.id);
      const base = exists ? prev.map(r => (r.id === rel.id ? rel : r)) : [...prev, rel];
      return withActiveExclusivity(base, rel);
    });
    if (inactiveDueToConflict) addToast({ message: INACTIVE_NOTICE, type: 'warning' });
    else addToast({ message: editing ? 'Connection updated.' : 'Connection created.', type: 'success' });
    setView('list'); setEditing(undefined);
  };

  const setActive = (rel: Relationship, active: boolean) => {
    setRelationships(prev => withActiveExclusivity(prev.map(r => (r.id === rel.id ? { ...r, active } : r)), { ...rel, active }));
  };

  const runAutoDetect = () => {
    setDetecting(true);
    setTimeout(() => {
      setCandidates(autoDetect(tables, relationships));
      setDetecting(false);
      setView('autodetect');
    }, 700);
  };

  const applyCandidates = (selected: AutoDetectCandidate[]) => {
    setRelationships(prev => {
      let next = [...prev];
      selected.forEach(c => {
        const active = !pairHasActive(next, c.leftTable, c.rightTable);
        const rel: Relationship = { id: `rel-${Date.now()}-${c.id}`, leftTable: c.leftTable, rightTable: c.rightTable, columnPairs: c.columnPairs, active };
        next = withActiveExclusivity([...next, rel], rel);
      });
      return next;
    });
    addToast({ message: `${selected.length} connection${selected.length === 1 ? '' : 's'} added.`, type: 'success' });
    setView('list');
  };

  const confirmDelete = (rel: Relationship) => {
    const affected = widgets.filter(w => widgetUsesRelationship(w.model, rel));
    if (affected.length > 0) { setDeleteTarget(rel); return; }
    doDelete(rel);
  };

  const doDelete = (rel: Relationship) => {
    setRelationships(prev => {
      let next = prev.filter(r => r.id !== rel.id);
      // If the active one was removed, promote an alternate for that pair.
      if (rel.active) {
        const alt = next.find(r => (r.leftTable === rel.leftTable && r.rightTable === rel.rightTable) || (r.leftTable === rel.rightTable && r.rightTable === rel.leftTable));
        if (alt) { next = next.map(r => (r.id === alt.id ? { ...r, active: true } : r)); addToast({ message: 'Promoted an alternate connection to active.', type: 'info' }); }
      }
      return next;
    });
    setDeleteTarget(null);
    addToast({ message: 'Connection removed.', type: 'success' });
  };

  const affectedByTarget = deleteTarget ? widgets.filter(w => widgetUsesRelationship(w.model, deleteTarget)) : [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]" />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 12 }}
        className="relative bg-white rounded-xl shadow-2xl w-[640px] max-w-[94vw] max-h-[86vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <header className="shrink-0 px-5 py-3.5 border-b border-border-light flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center"><Link2 size={15} /></div>
            <div>
              <h3 className="text-[0.875rem] font-semibold text-text">Table relationships</h3>
              <p className="text-[0.71875rem] text-text-muted">Connect tables so a single widget can combine fields from several of them.</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full text-text-muted hover:text-text hover:bg-paper-50 flex items-center justify-center cursor-pointer"><X size={16} /></button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {view === 'list' && (
            <div className="p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-text-muted">{relationships.length} connection{relationships.length === 1 ? '' : 's'}</span>
                <div className="flex items-center gap-2">
                  <button onClick={runAutoDetect} disabled={detecting} className="inline-flex items-center gap-1.5 h-8 px-3 text-[0.75rem] font-semibold text-primary bg-primary-xlight border border-primary/15 rounded-md hover:bg-primary-xlight/70 cursor-pointer disabled:opacity-60">
                    {detecting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Auto-detect
                  </button>
                  <button onClick={() => { setEditing(undefined); setView('editor'); }} className="inline-flex items-center gap-1.5 h-8 px-3 text-[0.75rem] font-semibold text-white bg-primary hover:bg-primary-hover rounded-md cursor-pointer"><Plus size={13} /> New connection</button>
                </div>
              </div>

              {relationships.length === 0 ? (
                <div className="border border-dashed border-border-light rounded-lg p-8 text-center">
                  <Link2 size={20} className="text-text-muted/50 mx-auto mb-2" />
                  <p className="text-[0.78125rem] font-semibold text-text">No connections yet</p>
                  <p className="text-[0.71875rem] text-text-muted mt-1">Use Auto-detect to find matching columns, or create one manually.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {relationships.map(rel => (
                    <div key={rel.id} className="border border-border-light rounded-lg px-3.5 py-2.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-[0.78125rem] text-text flex-wrap">
                          <span className="font-semibold">{tname(rel.leftTable)}</span>
                          <ArrowLeftRight size={12} className="text-text-muted shrink-0" />
                          <span className="font-semibold">{tname(rel.rightTable)}</span>
                        </div>
                        <div className="text-[0.6875rem] text-text-muted mt-0.5">
                          {rel.columnPairs.map((p, i) => (
                            <span key={i}>{i > 0 ? ' · ' : ''}{clabel(rel.leftTable, p.left)} = {clabel(rel.rightTable, p.right)}</span>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => setActive(rel, !rel.active)}
                        title={rel.active ? 'Active — used when combining these tables. Click to deactivate.' : 'Inactive. Click to make this the active connection.'}
                        className={`shrink-0 inline-flex items-center h-6 px-2.5 text-[0.65625rem] font-semibold rounded-full cursor-pointer transition-colors ${rel.active ? 'bg-compliant-50 text-compliant-700' : 'bg-[#EEEEF1] text-ink-600 hover:bg-paper-50'}`}
                      >
                        {rel.active ? 'Active' : 'Inactive'}
                      </button>
                      <button onClick={() => { setEditing(rel); setView('editor'); }} className="shrink-0 w-7 h-7 rounded flex items-center justify-center text-text-muted hover:text-primary hover:bg-primary-xlight cursor-pointer"><Pencil size={13} /></button>
                      <button onClick={() => confirmDelete(rel)} className="shrink-0 w-7 h-7 rounded flex items-center justify-center text-text-muted hover:text-risk-700 hover:bg-risk-50 cursor-pointer"><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'editor' && (
            <RelationshipEditor tables={tables} relationships={relationships} initial={editing} onSave={upsert} onCancel={() => { setView('list'); setEditing(undefined); }} />
          )}

          {view === 'autodetect' && (
            <AutoDetectReview candidates={candidates} tables={tables} onApply={applyCandidates} onCancel={() => setView('list')} />
          )}
        </div>

        {/* Delete-impact confirmation */}
        <AnimatePresence>
          {deleteTarget && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-white/70 backdrop-blur-[1px]">
              <div className="bg-white border border-border-light rounded-lg shadow-xl w-[380px] p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-risk-50 text-risk-700 flex items-center justify-center"><AlertTriangle size={15} /></div>
                  <h4 className="text-[0.875rem] font-semibold text-text">Remove this connection?</h4>
                </div>
                <p className="text-[0.78125rem] text-text-secondary leading-relaxed mb-2">
                  {affectedByTarget.length} widget{affectedByTarget.length === 1 ? '' : 's'} combine these tables and will need attention:
                </p>
                <ul className="mb-4 space-y-1">
                  {affectedByTarget.slice(0, 5).map((w, i) => <li key={i} className="text-[0.75rem] text-text flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-text-muted" /> {w.title}</li>)}
                </ul>
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => setDeleteTarget(null)} className="h-9 px-4 text-[0.78125rem] font-medium text-text bg-white border border-border-light rounded-md hover:bg-paper-50 cursor-pointer">Cancel</button>
                  <button onClick={() => doDelete(deleteTarget)} className="h-9 px-4 text-[0.78125rem] font-semibold text-white bg-risk hover:bg-risk-700 rounded-md cursor-pointer">Remove anyway</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
