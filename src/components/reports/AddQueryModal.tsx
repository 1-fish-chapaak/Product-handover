// Add-Query modal — pick an existing query, a data source, or upload a file to
// attach to a report. Extracted from the report reader; self-contained.

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, CloudUpload, Database, FileText, Layers, Loader2, MessageSquare, Search, Star, Upload, X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { QUERY_SESSIONS, FAVOURITES } from '../../data/queryHistory';
import { SEED, TYPE_META, formatDate } from '../data-sources/sources';

type AddQueryTab = 'recent' | 'saved' | 'upload' | 'all' | 'files' | 'db';

export default function AddQueryModal({ open, onClose, onAttach }: {
  open: boolean;
  onClose: () => void;
  onAttach: (selection: { kind: 'query' | 'source' | 'upload'; label: string }) => void;
}) {
  const [activeTab, setActiveTab] = useState<AddQueryTab>('recent');
  const [search, setSearch] = useState('');
  const [selectedQuery, setSelectedQuery] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, open, onClose);

  if (!open) return null;

  const allSources = SEED;
  const fileSources = allSources.filter(s => s.type === 'file');
  const dbSources = allSources.filter(s => s.type === 'database' || s.type === 'api' || s.type === 'cloud');

  const handleClose = () => {
    setActiveTab('recent');
    setSearch('');
    setSelectedQuery(null);
    setSelectedSource(null);
    setUploadedFile(null);
    setDragging(false);
    onClose();
  };

  const handleAttach = () => {
    if (isAttaching) return;
    setIsAttaching(true);
    // Resolve once parent state has settled.
    window.setTimeout(() => {
      if ((activeTab === 'recent' || activeTab === 'saved') && selectedQuery) {
        onAttach({ kind: 'query', label: selectedQuery });
        handleClose();
      } else if (activeTab === 'upload' && uploadedFile) {
        onAttach({ kind: 'upload', label: uploadedFile.name });
        handleClose();
      } else if ((activeTab === 'all' || activeTab === 'files' || activeTab === 'db') && selectedSource) {
        const src = allSources.find(s => s.id === selectedSource);
        if (src) {
          onAttach({ kind: 'source', label: src.name });
          handleClose();
        }
      }
      setIsAttaching(false);
    }, 120);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center"
          onClick={handleClose}
        >
          <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]" />
          <motion.div
            ref={containerRef}
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-label="Add Query"
            className="relative bg-canvas-elevated rounded-[16px] border border-canvas-border shadow-2xl flex flex-col overflow-hidden w-[840px] h-[600px]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-7 py-4 border-b border-canvas-border">
              <h2 className="text-[16px] font-bold text-ink-900 shrink-0">Add Query</h2>
              <div className="flex-1 mx-5 relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={activeTab === 'upload' ? 'Drop files below to upload...' : 'Search...'}
                  className="w-full pl-10 pr-4 py-2 text-[13px] border border-canvas-border rounded-full bg-canvas-elevated text-ink-800 placeholder:text-ink-400 outline-none focus:border-brand-400 transition-colors"
                />
              </div>
              <button onClick={handleClose} className="p-1.5 rounded-[8px] hover:bg-canvas transition-colors cursor-pointer shrink-0">
                <X size={20} className="text-ink-400" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-5 px-7 border-b border-canvas-border">
              {([
                { id: 'recent' as AddQueryTab, label: 'Recent Chats', icon: MessageSquare, count: QUERY_SESSIONS.reduce((n, g) => n + g.items.length, 0) },
                { id: 'saved' as AddQueryTab, label: 'Favourites', icon: Star, count: FAVOURITES.reduce((n, g) => n + g.items.length, 0) },
                { id: 'upload' as AddQueryTab, label: 'Upload', icon: Upload, count: 0 },
                { id: 'all' as AddQueryTab, label: 'All Data', icon: Layers, count: allSources.length },
                { id: 'files' as AddQueryTab, label: 'Files', icon: FileText, count: fileSources.length },
                { id: 'db' as AddQueryTab, label: 'DB', icon: Database, count: dbSources.length },
              ]).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setSelectedQuery(null); setSelectedSource(null); }}
                  className={`flex items-center gap-1.5 pb-3 pt-3 text-[13px] font-semibold transition-colors cursor-pointer relative whitespace-nowrap ${
                    activeTab === tab.id ? 'text-brand-700' : 'text-ink-400 hover:text-ink-600'
                  }`}
                >
                  <tab.icon size={14} />
                  {tab.label}
                  {tab.count > 0 && <span className="text-[11px] text-ink-400 font-normal">{tab.count}</span>}
                  {activeTab === tab.id && (
                    <motion.div layoutId="add-query-tab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-600 rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-7 py-6">
              <AnimatePresence mode="wait">
                {(activeTab === 'recent' || activeTab === 'saved') && (() => {
                  const groups = activeTab === 'recent' ? QUERY_SESSIONS : FAVOURITES;
                  const hasResults = groups.some(g => g.items.some(q => q.toLowerCase().includes(search.toLowerCase())));
                  return (
                    <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                      {hasResults ? (
                        <div className="space-y-4">
                          {groups.map(group => {
                            const filtered = group.items.filter(q => q.toLowerCase().includes(search.toLowerCase()));
                            if (filtered.length === 0) return null;
                            return (
                              <div key={group.group || 'ungrouped'}>
                                {group.group && <div className="text-[11px] font-bold text-ink-500 uppercase tracking-wider mb-2">{group.group}</div>}
                                <div className="space-y-2">
                                  {filtered.map(q => (
                                    <button
                                      key={q}
                                      onClick={() => setSelectedQuery(q)}
                                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-[12px] border transition-all cursor-pointer text-left ${
                                        selectedQuery === q ? 'border-brand-500 bg-brand-50' : 'border-canvas-border bg-canvas-elevated hover:border-brand-200'
                                      }`}
                                    >
                                      {activeTab === 'recent'
                                        ? <MessageSquare size={14} className={selectedQuery === q ? 'text-brand-600' : 'text-ink-400'} />
                                        : <Star size={14} className={selectedQuery === q ? 'text-brand-600' : 'text-ink-400'} />}
                                      <span className={`text-[13px] ${selectedQuery === q ? 'text-brand-700 font-medium' : 'text-ink-700'}`}>{q}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          {activeTab === 'recent' ? <MessageSquare size={32} className="text-ink-200 mb-3" /> : <Star size={32} className="text-ink-200 mb-3" />}
                          <p className="text-[14px] font-medium text-ink-500 mb-1">
                            {activeTab === 'recent' ? 'No chats found' : 'No favourites found'}
                          </p>
                          <p className="text-[12px] text-ink-400">
                            {search ? 'Try a different search term.' : activeTab === 'recent' ? 'Start a new chat to see it here.' : 'Star a chat to add it to favourites.'}
                          </p>
                        </div>
                      )}
                    </motion.div>
                  );
                })()}

                {activeTab === 'upload' && (
                  <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                    <input
                      id="add-query-file-input"
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) setUploadedFile(f); }}
                    />
                    <div
                      onDragOver={e => { e.preventDefault(); setDragging(true); }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) setUploadedFile(f); }}
                      onClick={() => !uploadedFile && document.getElementById('add-query-file-input')?.click()}
                      className={`border-2 border-dashed rounded-[12px] p-12 flex flex-col items-center justify-center text-center transition-all min-h-[300px] ${
                        dragging
                          ? 'border-brand-500 bg-brand-50'
                          : uploadedFile
                            ? 'border-compliant bg-green-50/30 cursor-default'
                            : 'border-ink-200 bg-canvas/30 cursor-pointer hover:border-brand-300 hover:bg-brand-50/20'
                      }`}
                    >
                      {uploadedFile ? (
                        <div>
                          <CloudUpload size={32} className="text-green-600 mx-auto mb-3" />
                          <h3 className="text-[15px] font-bold text-ink-900 mb-1">{uploadedFile.name}</h3>
                          <p className="text-[13px] text-compliant font-medium mb-1">
                            {(uploadedFile.size / 1024).toFixed(1)} KB — File ready
                          </p>
                          <button
                            onClick={e => { e.stopPropagation(); setUploadedFile(null); }}
                            className="text-[12px] text-ink-400 hover:text-red-500 transition-colors cursor-pointer mt-1"
                          >
                            Remove file
                          </button>
                        </div>
                      ) : (
                        <>
                          <Upload size={32} className="text-ink-300 mb-3" />
                          <h3 className="text-[14px] font-semibold text-ink-800 mb-1">Drop files here</h3>
                          <p className="text-[13px] text-ink-400 mb-4">or pick from your computer</p>
                          <button
                            onClick={e => { e.stopPropagation(); document.getElementById('add-query-file-input')?.click(); }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-[13px] font-semibold rounded-[8px] transition-colors cursor-pointer"
                          >
                            <Upload size={14} />
                            Choose files
                          </button>
                          <p className="text-[11px] text-ink-400 mt-3">CSV · Excel · ≤ 50 MB each</p>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}

                {(activeTab === 'all' || activeTab === 'files' || activeTab === 'db') && (() => {
                  const sources = (activeTab === 'all' ? allSources : activeTab === 'files' ? fileSources : dbSources)
                    .filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
                  const tabLabel = activeTab === 'all' ? 'data sources' : activeTab === 'files' ? 'files' : 'databases';
                  return (
                    <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                      {sources.length > 0 ? (
                        <div className="space-y-1.5">
                          {sources.map(source => {
                            const meta = TYPE_META[source.type];
                            const Icon = meta.icon;
                            const isSelected = selectedSource === source.id;
                            return (
                              <button
                                key={source.id}
                                onClick={() => setSelectedSource(isSelected ? null : source.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-[12px] border transition-all cursor-pointer text-left ${
                                  isSelected ? 'border-brand-500 bg-brand-50' : 'border-canvas-border bg-canvas-elevated hover:border-brand-200'
                                }`}
                              >
                                <div className={`size-8 rounded-[8px] flex items-center justify-center shrink-0 ${meta.tone}`}>
                                  <Icon size={14} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[13px] font-medium text-ink-900 truncate">{source.name}</div>
                                  <div className="text-[11px] text-ink-400">{source.subtype} · {formatDate(source.createdAt)}</div>
                                </div>
                                {isSelected && <Check size={16} className="text-brand-600 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <Search size={32} className="text-ink-200 mb-3" />
                          <p className="text-[14px] font-medium text-ink-500 mb-1">No {tabLabel} found</p>
                          <p className="text-[12px] text-ink-400">
                            {search ? 'Try a different search term.' : `No ${tabLabel} available.`}
                          </p>
                        </div>
                      )}
                    </motion.div>
                  );
                })()}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-7 py-4 border-t border-canvas-border">
              <p className="text-[12px] text-ink-400 mr-auto">Pick a saved query, file, or data source to attach.</p>
              <button onClick={handleClose} className="inline-flex items-center justify-center gap-1.5 h-9 px-5 rounded-[8px] text-[13px] font-semibold text-ink-800 bg-white border border-canvas-border hover:bg-paper-50 transition-colors cursor-pointer">
                Cancel
              </button>
              {(() => {
                const enabled =
                  ((activeTab === 'recent' || activeTab === 'saved') && !!selectedQuery) ||
                  (activeTab === 'upload' && !!uploadedFile) ||
                  ((activeTab === 'all' || activeTab === 'files' || activeTab === 'db') && !!selectedSource);
                return (
                  <button
                    onClick={handleAttach}
                    disabled={!enabled || isAttaching}
                    className={`inline-flex items-center justify-center gap-1.5 h-9 px-5 rounded-[8px] text-[13px] font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 ${
                      enabled && !isAttaching ? 'bg-brand-600 hover:bg-brand-500 text-white' : 'bg-ink-100 text-ink-400 cursor-not-allowed'
                    }`}
                  >
                    {isAttaching ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    {isAttaching ? 'Attaching…' : 'Attach'}
                  </button>
                );
              })()}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
