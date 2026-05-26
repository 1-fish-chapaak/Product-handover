import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Plus, MessageSquare, Star, Upload, Layers, FileText, Database,
  CloudUpload, Check,
} from 'lucide-react';
import { SEED, TYPE_META, formatDate, type DataSource } from '../data-sources/sources';
import { QUERY_SESSIONS, FAVOURITES } from '../../data/queryHistory';

// ─── Types ───────────────────────────────────────────────────────────────────

type AddDataTab = 'recent' | 'saved' | 'upload' | 'all' | 'files' | 'db';

/** A source attached to the dashboard. May be a SEED entry (id matches) or a
 *  synthetic entry for an uploaded file or chat-derived query (no id in SEED). */
export interface AttachedSource {
  /** SEED id when known; falsy for uploaded files / chat queries. */
  id?: string;
  name: string;
  type: DataSource['type'] | 'query';
  subtype?: string;
}

interface AddDataModalProps {
  open: boolean;
  onClose: () => void;
  onOpenChat?: () => void;
  /** Fired when the user clicks Attach on a tab. The caller is responsible
   *  for appending the source to the dashboard's `dataSourceNames` and
   *  flipping `dataSource.type` to 'combo' if needed. */
  onAttach?: (source: AttachedSource) => void;
  /** Sources already connected to the dashboard. When provided, the modal
   *  renders a "Connected sources" section above the tabs with a Set Primary
   *  radio next to each entry. */
  connectedSources?: AttachedSource[];
  /** id of the source currently marked as the dashboard's primary. */
  primarySourceId?: string;
  /** Fired when the user clicks the Set Primary radio. */
  onSetPrimary?: (source: AttachedSource) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AddDataModal({ open, onClose, onOpenChat, onAttach, connectedSources, primarySourceId, onSetPrimary }: AddDataModalProps) {
  const [activeTab, setActiveTab] = useState<AddDataTab>('recent');
  const [querySearch, setQuerySearch] = useState('');
  const [selectedQuery, setSelectedQuery] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  const allSources = SEED;
  const fileSources = allSources.filter(s => s.type === 'file');
  const dbSources = allSources.filter(s => s.type === 'database' || s.type === 'api' || s.type === 'cloud');

  const handleClose = () => {
    setActiveTab('recent');
    setQuerySearch('');
    setSelectedQuery(null);
    setSelectedSource(null);
    setUploadedFile(null);
    setDragging(false);
    onClose();
  };

  if (!open) return null;

  const TABS: { id: AddDataTab; label: string; icon: React.ElementType; count: number }[] = [
    { id: 'recent', label: 'Recent Chats', icon: MessageSquare, count: QUERY_SESSIONS.reduce((n, g) => n + g.items.length, 0) },
    { id: 'saved', label: 'Favourites', icon: Star, count: FAVOURITES.reduce((n, g) => n + g.items.length, 0) },
    { id: 'upload', label: 'Upload', icon: Upload, count: 0 },
    { id: 'all', label: 'All Data', icon: Layers, count: allSources.length },
    { id: 'files', label: 'Files', icon: FileText, count: fileSources.length },
    { id: 'db', label: 'DB', icon: Database, count: dbSources.length },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        onClick={handleClose}
      >
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative bg-canvas-elevated rounded-2xl border border-canvas-border shadow-2xl flex flex-col overflow-hidden w-[820px] h-[600px]"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-7 py-5 border-b border-canvas-border">
            <h2 className="text-[1rem] font-bold text-ink-900 shrink-0">Add data</h2>
            <div className="flex-1 mx-5 relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                type="text"
                value={querySearch}
                onChange={e => setQuerySearch(e.target.value)}
                placeholder={activeTab === 'upload' ? 'Drop files below to upload...' : 'Search...'}
                className="w-full pl-10 pr-4 py-2 text-[0.8125rem] border border-canvas-border rounded-full bg-canvas-elevated text-ink-800 placeholder:text-ink-400 outline-none focus:border-brand-400 transition-colors"
              />
            </div>
            <button
              onClick={() => { handleClose(); onOpenChat?.(); }}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-[0.75rem] font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <Plus size={14} />
              New Chat
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex gap-5 px-7 border-b border-canvas-border">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSelectedQuery(null); setSelectedSource(null); }}
                className={`flex items-center gap-1.5 pb-3 pt-3 text-[0.8125rem] font-semibold transition-colors cursor-pointer relative whitespace-nowrap ${
                  activeTab === tab.id ? 'text-brand-700' : 'text-ink-400 hover:text-ink-600'
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
                {tab.count > 0 && <span className="text-[0.6875rem] text-ink-400 font-normal">{tab.count}</span>}
                {activeTab === tab.id && (
                  <motion.div layoutId="add-data-modal-tab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-600 rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-7 py-6">
            {/* Connected sources — only when caller passed connectedSources (dashboard-management mode) */}
            {connectedSources && connectedSources.length > 0 && (
              <div className="mb-5 pb-5 border-b border-canvas-border">
                <div className="text-[0.6875rem] font-bold text-ink-500 uppercase tracking-wider mb-2">Connected sources ({connectedSources.length})</div>
                <div className="space-y-1.5">
                  {connectedSources.map(src => {
                    const meta = src.type !== 'query' ? TYPE_META[src.type as DataSource['type']] : undefined;
                    const Icon = meta?.icon ?? MessageSquare;
                    const tone = meta?.tone ?? 'bg-amber-50 text-amber-700';
                    const isPrimary = !!src.id && src.id === primarySourceId;
                    return (
                      <div
                        key={src.id || src.name}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all text-left ${
                          isPrimary ? 'border-brand-500 bg-brand-50' : 'border-canvas-border bg-canvas-elevated'
                        }`}
                      >
                        <div className={`size-7 rounded-md flex items-center justify-center shrink-0 ${tone}`}>
                          <Icon size={12} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[0.8125rem] font-medium text-ink-900 truncate">{src.name}</div>
                          {src.subtype && <div className="text-[0.6875rem] text-ink-400 truncate">{src.subtype}</div>}
                        </div>
                        {onSetPrimary && (
                          <button
                            type="button"
                            onClick={() => onSetPrimary(src)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 text-[0.6875rem] font-medium rounded-md transition-colors cursor-pointer shrink-0 ${
                              isPrimary ? 'text-brand-700 bg-brand-100' : 'text-ink-500 hover:text-brand-600 hover:bg-brand-50'
                            }`}
                            title={isPrimary ? 'Primary source' : 'Set as primary'}
                          >
                            <span className={`size-[10px] rounded-full border-2 ${isPrimary ? 'border-brand-600 bg-brand-600' : 'border-ink-300 bg-white'}`}>
                              {isPrimary && <span className="block size-full rounded-full ring-2 ring-inset ring-white" />}
                            </span>
                            {isPrimary ? 'Primary' : 'Set primary'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <AnimatePresence mode="wait">
              {/* Recent Chats / Favourites */}
              {(activeTab === 'recent' || activeTab === 'saved') && (() => {
                const groups = activeTab === 'recent' ? QUERY_SESSIONS : FAVOURITES;
                const hasResults = groups.some(g => g.items.some(q => q.toLowerCase().includes(querySearch.toLowerCase())));
                return (
                  <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                    {hasResults ? (
                      <div className="space-y-4 max-h-[400px] overflow-y-auto">
                        {groups.map(group => {
                          const filtered = group.items.filter(q => q.toLowerCase().includes(querySearch.toLowerCase()));
                          if (filtered.length === 0) return null;
                          return (
                            <div key={group.group || 'ungrouped'}>
                              {group.group && <div className="text-[0.6875rem] font-bold text-ink-500 uppercase tracking-wider mb-2">{group.group}</div>}
                              <div className="space-y-2">
                                {filtered.map(q => (
                                  <button
                                    key={q}
                                    onClick={() => setSelectedQuery(q)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer text-left ${
                                      selectedQuery === q ? 'border-brand-500 bg-brand-50' : 'border-canvas-border bg-canvas-elevated hover:border-brand-200'
                                    }`}
                                  >
                                    {activeTab === 'recent' && <MessageSquare size={14} className={selectedQuery === q ? 'text-brand-600' : 'text-ink-400'} />}
                                    {activeTab === 'saved' && <Star size={14} className={selectedQuery === q ? 'text-brand-600' : 'text-ink-400'} />}
                                    <span className={`text-[0.8125rem] ${selectedQuery === q ? 'text-brand-700 font-medium' : 'text-ink-700'}`}>{q}</span>
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
                        <p className="text-[0.875rem] font-medium text-ink-500 mb-1">
                          {activeTab === 'recent' ? 'No chats found' : 'No favourites found'}
                        </p>
                        <p className="text-[0.75rem] text-ink-400">
                          {querySearch ? 'Try a different search term.' : activeTab === 'recent' ? 'Start a new chat to see it here.' : 'Star a chat to add it to favourites.'}
                        </p>
                      </div>
                    )}
                  </motion.div>
                );
              })()}

              {/* Upload */}
              {activeTab === 'upload' && (
                <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                  <input
                    id="add-data-modal-file-input"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) setUploadedFile(f); }}
                  />
                  <div
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) setUploadedFile(f); }}
                    onClick={() => !uploadedFile && document.getElementById('add-data-modal-file-input')?.click()}
                    className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center transition-all min-h-[300px] ${
                      dragging
                        ? 'border-brand-500 bg-brand-50'
                        : uploadedFile
                          ? 'border-compliant bg-green-50/30 cursor-default'
                          : 'border-ink-200 bg-surface-2/30 cursor-pointer hover:border-brand-300 hover:bg-brand-50/20'
                    }`}
                  >
                    {uploadedFile ? (
                      <div>
                        <CloudUpload size={28} className="text-green-600 mx-auto mb-3" />
                        <h3 className="text-[0.9375rem] font-bold text-ink-900 mb-1">{uploadedFile.name}</h3>
                        <p className="text-[0.8125rem] text-compliant font-medium mb-1">
                          {(uploadedFile.size / 1024).toFixed(1)} KB — File ready
                        </p>
                        <button
                          onClick={e => { e.stopPropagation(); setUploadedFile(null); }}
                          className="text-[0.75rem] text-ink-400 hover:text-red-500 transition-colors cursor-pointer mt-1"
                        >
                          Remove file
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload size={28} className="text-ink-300 mb-3" />
                        <h3 className="text-[0.875rem] font-semibold text-ink-800 mb-1">Drop files here</h3>
                        <p className="text-[0.8125rem] text-ink-400 mb-4">or pick from your computer</p>
                        <button
                          onClick={e => { e.stopPropagation(); document.getElementById('add-data-modal-file-input')?.click(); }}
                          className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-[0.8125rem] font-semibold rounded-lg transition-colors cursor-pointer"
                        >
                          <Upload size={14} />
                          Choose files
                        </button>
                        <p className="text-[0.6875rem] text-ink-400 mt-3">CSV · Excel · ≤ 50 MB each</p>
                      </>
                    )}
                  </div>
                </motion.div>
              )}

              {/* All Data / Files / DB */}
              {(activeTab === 'all' || activeTab === 'files' || activeTab === 'db') && (() => {
                const sources = (activeTab === 'all' ? allSources : activeTab === 'files' ? fileSources : dbSources)
                  .filter(s => s.name.toLowerCase().includes(querySearch.toLowerCase()));
                const tabLabel = activeTab === 'all' ? 'data sources' : activeTab === 'files' ? 'files' : 'databases';
                return (
                  <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                    {sources.length > 0 ? (
                      <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                        {sources.map(source => {
                          const { icon: Icon, tone } = TYPE_META[source.type];
                          const isSelected = selectedSource === source.id;
                          return (
                            <button
                              key={source.id}
                              onClick={() => setSelectedSource(isSelected ? null : source.id)}
                              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer text-left ${
                                isSelected ? 'border-brand-500 bg-brand-50' : 'border-canvas-border bg-canvas-elevated hover:border-brand-200'
                              }`}
                            >
                              <div className={`size-8 rounded-md flex items-center justify-center shrink-0 ${tone}`}>
                                <Icon size={14} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[0.8125rem] font-medium text-ink-900 truncate">{source.name}</div>
                                <div className="text-[0.6875rem] text-ink-400">{source.subtype} · {formatDate(source.createdAt)}</div>
                              </div>
                              {isSelected && <Check size={16} className="text-brand-600 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <Search size={32} className="text-ink-200 mb-3" />
                        <p className="text-[0.875rem] font-medium text-ink-500 mb-1">No {tabLabel} found</p>
                        <p className="text-[0.75rem] text-ink-400">
                          {querySearch ? 'Try a different search term.' : `No ${tabLabel} available.`}
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
            <p className="text-[0.75rem] text-ink-400 mr-auto">Pick sources or files to attach.</p>
            <button onClick={handleClose} className="px-5 py-2.5 text-[0.8125rem] font-semibold text-ink-600 hover:text-ink-800 transition-colors cursor-pointer">
              Cancel
            </button>
            {(activeTab === 'recent' || activeTab === 'saved') && (
              <button
                onClick={() => { handleClose(); onOpenChat?.(); }}
                disabled={!selectedQuery}
                className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[0.8125rem] font-semibold transition-colors cursor-pointer ${
                  selectedQuery ? 'bg-brand-600 hover:bg-brand-500 text-white' : 'bg-ink-100 text-ink-400 cursor-not-allowed'
                }`}
              >
                <MessageSquare size={14} />
                Open in Chat
              </button>
            )}
            {activeTab === 'upload' && (
              <button
                disabled={!uploadedFile}
                onClick={() => {
                  if (!uploadedFile) return;
                  const isCsv = uploadedFile.name.toLowerCase().endsWith('.csv');
                  onAttach?.({ name: uploadedFile.name, type: 'file', subtype: isCsv ? 'CSV' : 'XLSX' });
                  handleClose();
                }}
                className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[0.8125rem] font-semibold transition-colors cursor-pointer ${
                  uploadedFile ? 'bg-brand-600 hover:bg-brand-500 text-white' : 'bg-ink-100 text-ink-400 cursor-not-allowed'
                }`}
              >
                <Check size={14} />
                Attach
              </button>
            )}
            {(activeTab === 'all' || activeTab === 'files' || activeTab === 'db') && (
              <button
                disabled={!selectedSource}
                onClick={() => {
                  const src = allSources.find(s => s.id === selectedSource);
                  if (!src) return;
                  onAttach?.({ id: src.id, name: src.name, type: src.type, subtype: src.subtype });
                  handleClose();
                }}
                className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[0.8125rem] font-semibold transition-colors cursor-pointer ${
                  selectedSource ? 'bg-brand-600 hover:bg-brand-500 text-white' : 'bg-ink-100 text-ink-400 cursor-not-allowed'
                }`}
              >
                <Check size={14} />
                Attach
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
