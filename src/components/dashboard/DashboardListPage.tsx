import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Clock, Plus, ChevronDown, LayoutGrid, MoreVertical,
  Trash2, Check, Download, Share2, X, MessageSquare, Upload, Database, CloudUpload,
  Star, Layers, FileText, GripVertical, BarChart3
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import { useShare, rectFromEvent } from '../../context/ShareContext';
import { useCan } from '../../context/CurrentUserContext';
import Gated from '../shared/Gated';
import { SEED, TYPE_META, formatDate, type DataSource } from '../data-sources/sources';
import { DB_SCHEMAS, INTEGRATION_CONFIGS } from '../data-sources/datasetFiles';
import { QUERY_SESSIONS, FAVOURITES } from '../../data/queryHistory';

// ─── Types ──────────────────────────────────────────────────────────────────

export type DashboardSourceType = 'excel' | 'csv' | 'sql' | 'query' | 'combo';

interface Dashboard {
  id: string;
  name: string;
  description: string;
  timeAgo: string;
  creator: string;
  accent: string;
  sharedBy?: string;
  dataSource?: DashboardSourceType;
  dataSourceNames?: string[];
  /** SEED id of the source picked at creation. Required for live-SQL dashboards. */
  sourceId?: string;
}

export interface DashboardCreateOpts {
  customFields?: string[];
  sourceType?: DashboardSourceType;
  sourceId?: string;
  sourceName?: string;
}

type SortOption = 'recently' | 'oldest' | 'nameAZ' | 'nameZA';

interface DashboardListPageProps {
  onDashboardClick: (dashboardId: string, customFields?: string[]) => void;
  /** When set (typically from a notification deep-link), the matching
   *  dashboard card pulses briefly to draw the user's eye. Cleared by the
   *  parent ~3s after navigation. */
  focusedDashboardId?: string | null;
  onImportPowerBI?: () => void;
  createdDashboards?: Dashboard[];
  onCreateDashboard?: (dashboard: Dashboard) => void;
  onDeleteDashboard?: (id: string) => void;
  /** Persist a source-binding change made via the kebab "Change data source"
   *  menu. Fires with a partial patch of the dashboard's source fields. */
  onUpdateDashboardSource?: (id: string, patch: { dataSource?: DashboardSourceType; sourceId?: string; dataSourceNames?: string[] }) => void;
  onOpenChat?: (pendingDashboard?: { name: string; description: string }) => void;
}

// ─── Data ───────────────────────────────────────────────────────────────────

const MY_DASHBOARDS: Dashboard[] = [
  {
    id: 'p2p',
    name: 'Procurement (P2P)',
    description: 'Procure-to-Pay analytics — invoice processing, duplicate flags, compliance rate, and vendor spend tracking.',
    timeAgo: '2 hours ago',
    creator: 'You',
    accent: 'bg-brand-50 text-brand-700',
    dataSource: 'excel',
    dataSourceNames: ['Invoice_Master.xlsx', 'Vendor_Finance.xlsx'],
  },
  {
    id: 'grc',
    name: 'GRC Overview',
    description: 'Governance, risk & compliance — total risks, controls tested, deficiencies, and workflow automation.',
    timeAgo: '3 hours ago',
    creator: 'You',
    accent: 'bg-brand-50 text-brand-700',
    dataSource: 'sql',
    dataSourceNames: ['audit_controls_db'],
  },
  {
    id: 'o2c',
    name: 'Order to Cash (O2C)',
    description: 'Revenue & collections overview — orders fulfilled, revenue recognized, DSO, and customer insights.',
    timeAgo: '5 hours ago',
    creator: 'You',
    accent: 'bg-brand-50 text-brand-700',
    dataSource: 'query',
    dataSourceNames: ['revenue_query'],
  },
  {
    id: 's2c',
    name: 'Source to Contract (S2C)',
    description: 'Sourcing & contract management — active contracts, vendor scores, savings realized, and expiry tracking.',
    timeAgo: '1 day ago',
    creator: 'You',
    accent: 'bg-brand-50 text-brand-700',
    dataSource: 'combo',
    dataSourceNames: ['Invoice_Master.xlsx', 'PO_Register.csv', 'vendor_query', 'contract_db'],
  },
];

const SHARED_DASHBOARDS: Dashboard[] = [
  {
    id: 'shared-1',
    name: 'Vendor Risk Assessment',
    description: 'Evaluation of vendor risk profiles across all business units.',
    timeAgo: '4 hours ago',
    creator: 'Sarah Johnson',
    accent: 'bg-brand-50 text-brand-700',
    sharedBy: 'Sarah Johnson',
  },
  {
    id: 'shared-2',
    name: 'SOX Compliance Tracker',
    description: 'End-to-end SOX compliance progress and control testing status.',
    timeAgo: '1 day ago',
    creator: 'Michael Chen',
    accent: 'bg-brand-50 text-brand-700',
    sharedBy: 'Michael Chen',
  },
  {
    id: 'shared-3',
    name: 'AP Duplicate Detection',
    description: 'Automated duplicate invoice detection across accounts payable.',
    timeAgo: '2 days ago',
    creator: 'David Martinez',
    accent: 'bg-brand-50 text-brand-700',
    sharedBy: 'David Martinez',
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseTimeAgo(timeAgo: string): number {
  const match = timeAgo.match(/(\d+)\s*(minute|hour|day)/);
  if (!match) return 0;
  const value = parseInt(match[1]);
  const unit = match[2];
  if (unit === 'day') return value * 1440;
  if (unit === 'hour') return value * 60;
  return value;
}

const SORT_LABELS: Record<SortOption, string> = {
  recently: 'Recently Updated',
  oldest: 'Oldest Updated',
  nameAZ: 'Name A–Z',
  nameZA: 'Name Z–A',
};

// ─── Component ──────────────────────────────────────────────────────────────


const QUERY_TEMPLATES = [
  { group: 'FINANCIAL', items: [
    'Revenue Analysis — by region, category, and time period',
    'Expense Breakdown — department-wise cost distribution',
    'Cash Flow Overview — inflows vs outflows over time',
  ]},
  { group: 'AUDIT & COMPLIANCE', items: [
    'Control Testing Summary — pass/fail rates by control',
    'Risk Heatmap — risk severity across business units',
    'Exception Aging — open exceptions by age bucket',
  ]},
  { group: 'OPERATIONS', items: [
    'Vendor Performance Scorecard — delivery, quality, cost',
    'Process Cycle Time — average processing duration by step',
  ]},
];

// ─── Create Dashboard Modal ─────────────────────────────────────────────────

// ─── File Tree Component (Navigator sidebar) ────────────────────────────────

function NavFileTree({ files }: { files: { name: string; sheets: { name: string; columns: string[] }[] }[] }) {
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({ [files[0]?.name]: true });
  const [expandedSheets, setExpandedSheets] = useState<Record<string, boolean>>({ [`${files[0]?.name}::${files[0]?.sheets[0]?.name}`]: true });

  return (
    <div className="space-y-2">
      {files.map(file => {
        const isFileOpen = expandedFiles[file.name] ?? false;
        return (
          <div key={file.name} className="bg-white rounded-[8px] border border-[#e5e7eb] overflow-hidden shadow-sm">
            <button
              onClick={() => setExpandedFiles(p => ({ ...p, [file.name]: !p[file.name] }))}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-[#faf5ff] to-white hover:from-[#f5f0ff] transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-[#6a12cd]" />
                <span className="text-[0.75rem] font-semibold text-[#26064a]">{file.name}</span>
              </div>
              <ChevronDown
                size={14}
                className="text-[#6a12cd] transition-transform"
                style={{ transform: isFileOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </button>
            {isFileOpen && (
              <div className="border-t border-[#f0f0f0]">
                {file.sheets.map(sheet => {
                  const key = `${file.name}::${sheet.name}`;
                  const isSheetOpen = expandedSheets[key] ?? false;
                  return (
                    <div key={key}>
                      <button
                        onClick={() => setExpandedSheets(p => ({ ...p, [key]: !p[key] }))}
                        className="w-full flex items-center justify-between px-4 py-2 hover:bg-[#faf5ff] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <LayoutGrid size={12} className="text-ink-400" />
                          <span className="text-[0.6875rem] font-medium text-ink-700">{sheet.name}</span>
                          <span className="text-[0.625rem] text-ink-400">({sheet.columns.length})</span>
                        </div>
                        <ChevronDown
                          size={12}
                          className="text-ink-400 transition-transform"
                          style={{ transform: isSheetOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        />
                      </button>
                      {isSheetOpen && (
                        <div className="pb-1">
                          {sheet.columns.map(col => (
                            <div key={col} className="flex items-center gap-2.5 px-6 py-1.5 hover:bg-[#f0ecff] transition-colors cursor-default">
                              <GripVertical size={11} className="text-ink-300 shrink-0" />
                              <span className="text-[0.6875rem] text-ink-600">{col}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

type CreateStep = 'details' | 'add-data' | 'navigator';
type AddDataTab = 'recent' | 'saved' | 'upload' | 'all' | 'files' | 'db';

function CreateDashboardModal({ open, onClose, onCreate, onOpenChat }: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string, opts?: DashboardCreateOpts) => void;
  onOpenChat?: (pendingDashboard?: { name: string; description: string }) => void;
}) {
  const [step, setStep] = useState<CreateStep>('details');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [activeTab, setActiveTab] = useState<AddDataTab>('recent');
  const [querySearch, setQuerySearch] = useState('');
  const [selectedQuery, setSelectedQuery] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedSheets, setSelectedSheets] = useState<string[]>(['Sheet 1']);
  const [activeSheet, setActiveSheet] = useState('Sheet 1');
  const [fileTreeExpanded, setFileTreeExpanded] = useState(true);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [sheetNames, setSheetNames] = useState<string[]>(['Sheet 1']);

  // Reset on open
  if (!open) return null;

  // Column cap: show at most 50 columns
  const totalColumns = parsedHeaders.length;
  const displayHeaders = parsedHeaders.slice(0, 50);
  const columnsTruncated = totalColumns > 50;

  // Row display: preview (50 rows) vs full data
  const displayRows = parsedRows.slice(0, 50).map(row => row.slice(0, 50));

  // Select All helpers
  const allSheetsSelected = sheetNames.length > 0 && sheetNames.every(s => selectedSheets.includes(s));
  const someSheetsSelected = sheetNames.some(s => selectedSheets.includes(s)) && !allSheetsSelected;

  const allSources = SEED;
  const fileSources = allSources.filter(s => s.type === 'file');
  const dbSources = allSources.filter(s => s.type === 'database' || s.type === 'api' || s.type === 'cloud');

  const handleClose = () => {
    setStep('details');
    setName('');
    setDescription('');
    setActiveTab('recent');
    setQuerySearch('');
    setSelectedQuery(null);
    setSelectedSource(null);
    setUploadedFile(null);
    setDragging(false);
    onClose();
  };

  const handleCreate = (withFields?: boolean) => {
    const fname = uploadedFile?.name || '';
    const isCsv = fname.toLowerCase().endsWith('.csv');
    onCreate(name, description, {
      customFields: withFields ? parsedHeaders : undefined,
      sourceType: uploadedFile ? (isCsv ? 'csv' : 'excel') : undefined,
      sourceName: uploadedFile ? fname : undefined,
    });
    handleClose();
  };

  const isAddData = step === 'add-data';
  const isNavigator = step === 'navigator';

  return (
    <AnimatePresence>
      {open && (
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
            className={`relative bg-canvas-elevated rounded-2xl border border-canvas-border shadow-2xl flex flex-col overflow-hidden ${
              isNavigator ? 'w-[1100px] h-[80vh]' : isAddData ? 'w-[820px] h-[600px]' : 'w-[520px]'
            }`}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-7 py-4 border-b border-canvas-border">
              <h2 className="text-[1rem] font-bold text-ink-900 shrink-0">{isNavigator ? 'Navigator' : 'Create Dashboard'}</h2>
              {isAddData && (
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
              )}
              <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer shrink-0">
                <X size={20} className="text-ink-400" />
              </button>
            </div>

            {/* Tab bar — only in add-data step */}
            {isAddData && (
              <div className="flex gap-5 px-7 border-b border-canvas-border">
                {([
                  { id: 'recent' as AddDataTab, label: 'Recent Chats', icon: MessageSquare, count: QUERY_SESSIONS.reduce((n, g) => n + g.items.length, 0) },
                  { id: 'saved' as AddDataTab, label: 'Favourites', icon: Star, count: FAVOURITES.reduce((n, g) => n + g.items.length, 0) },
                  { id: 'upload' as AddDataTab, label: 'Upload', icon: Upload, count: 0 },
                  { id: 'all' as AddDataTab, label: 'All Data', icon: Layers, count: allSources.length },
                  { id: 'files' as AddDataTab, label: 'Files', icon: FileText, count: fileSources.length },
                  { id: 'db' as AddDataTab, label: 'DB', icon: Database, count: dbSources.length },
                ]).map(tab => (
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
                      <motion.div layoutId="add-data-tab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-600 rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Content */}
            <div className={`flex-1 overflow-hidden ${isNavigator ? '' : 'overflow-y-auto px-7 py-6'}`}>
              <AnimatePresence mode="wait">
                {/* ── Step 1: Details ── */}
                {step === 'details' && (
                  <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.15 }} className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-[0.8125rem] font-bold text-ink-800">Dashboard Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g., Q3 Financial Overview"
                        autoFocus
                        className="w-full px-4 py-3 text-[0.875rem] border border-canvas-border rounded-xl text-ink-800 placeholder:text-ink-400 outline-none focus:border-brand-400 transition-colors bg-canvas-elevated"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[0.8125rem] font-bold text-ink-800">
                        Description <span className="font-normal text-ink-400">(Optional)</span>
                      </label>
                      <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Briefly describe the purpose of this dashboard..."
                        rows={4}
                        className="w-full px-4 py-3 text-[0.875rem] border border-canvas-border rounded-xl text-ink-800 placeholder:text-ink-400 outline-none focus:border-brand-400 transition-colors bg-canvas-elevated resize-none"
                      />
                    </div>
                  </motion.div>
                )}

                {/* ── Step 2: Add Data — chat tabs (recent / saved / templates) ── */}
                {isAddData && (activeTab === 'recent' || activeTab === 'saved') && (() => {
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

                {/* ── Step 2: Add Data — Upload tab ── */}
                {isAddData && activeTab === 'upload' && (
                  <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                    <input
                      id="create-dash-file-input"
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) setUploadedFile(f); }}
                    />
                    <div
                      onDragOver={e => { e.preventDefault(); setDragging(true); }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) setUploadedFile(f); }}
                      onClick={() => !uploadedFile && document.getElementById('create-dash-file-input')?.click()}
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
                            onClick={e => { e.stopPropagation(); document.getElementById('create-dash-file-input')?.click(); }}
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

                {/* ── Step 2: Add Data — All Data / Files / DB tabs ── */}
                {isAddData && (activeTab === 'all' || activeTab === 'files' || activeTab === 'db') && (() => {
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

                {/* ── Step 4: Navigator — real parsed data ── */}
                {step === 'navigator' && (
                  <motion.div key="navigator" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex h-full">
                    {/* Left sidebar — file tree */}
                    <div className="w-[280px] shrink-0 border-r border-canvas-border flex flex-col overflow-hidden">
                      <div className="px-4 pt-4 pb-3 shrink-0">
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                          <input type="text" placeholder="Search" className="w-full pl-9 pr-3 py-2 text-[0.8125rem] border border-canvas-border rounded-lg bg-canvas-elevated text-ink-800 placeholder:text-ink-400 outline-none focus:border-brand-400" />
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto px-4 pb-4">
                        <div className="mb-2">
                          <button
                            onClick={() => {
                              if (allSheetsSelected) setSelectedSheets([]);
                              else setSelectedSheets([...sheetNames]);
                            }}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer hover:bg-surface-2"
                          >
                            <div className={`size-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${allSheetsSelected ? 'bg-brand-600 border-brand-600' : someSheetsSelected ? 'bg-brand-300 border-brand-400' : 'border-ink-300 bg-white'}`}>
                              {allSheetsSelected && <svg viewBox="0 0 12 12" fill="none" className="size-2.5"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                              {someSheetsSelected && !allSheetsSelected && <svg viewBox="0 0 12 12" fill="none" className="size-2.5"><path d="M3 6H9" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>}
                            </div>
                            <span className="text-[0.75rem] font-semibold text-brand-700 truncate" title={uploadedFile?.name}>{uploadedFile?.name || 'Uploaded_Data.xlsx'}</span>
                          </button>
                          <div className="pl-6 space-y-0.5">
                            {sheetNames.map(sheet => {
                              const isSelected = selectedSheets.includes(sheet);
                              return (
                                <button
                                  key={sheet}
                                  onClick={() => {
                                    setActiveSheet(sheet);
                                    setSelectedSheets(prev => prev.includes(sheet) ? prev.filter(s => s !== sheet) : [...prev, sheet]);
                                  }}
                                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                                    activeSheet === sheet ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-surface-2'
                                  }`}
                                >
                                  <div className={`size-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-brand-600 border-brand-600' : 'border-ink-300 bg-white'}`}>
                                    {isSelected && <svg viewBox="0 0 12 12" fill="none" className="size-2.5"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                  </div>
                                  <span className="text-[0.75rem] truncate" title={sheet}>{sheet}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right — data preview table */}
                    <div className="flex-1 flex flex-col min-w-0">
                      <div className="flex-1 overflow-auto bg-white">
                        {displayHeaders.length > 0 ? (
                          <table className="w-full text-left">
                            <thead className="sticky top-0 z-10">
                              <tr className="bg-brand-50">
                                {displayHeaders.map((h, i) => (
                                  <th key={i} className="text-[0.6875rem] font-bold text-brand-800 uppercase tracking-wider px-5 py-3 border-b border-brand-200 whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {displayRows.map((row, i) => (
                                <tr key={i} className="border-b border-canvas-border/40 hover:bg-brand-50/20 transition-colors">
                                  {row.map((cell, j) => (
                                    <td key={j} className={`px-5 py-2.5 text-[0.8125rem] whitespace-nowrap ${j === 0 ? 'font-semibold text-ink-900' : 'text-ink-700'}`}>{cell}</td>
                                  ))}
                                  {row.length < displayHeaders.length && Array.from({ length: displayHeaders.length - row.length }).map((_, k) => (
                                    <td key={`pad-${k}`} className="px-5 py-2.5 text-[0.8125rem] text-ink-400">—</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="flex items-center justify-center h-full text-ink-400">
                            <p className="text-[0.8125rem]">No data to preview. Upload a CSV or XLSX file.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-7 py-4 border-t border-canvas-border">
              {step === 'details' && (
                <>
                  <button onClick={handleClose} className="px-5 py-2.5 text-[0.8125rem] font-semibold text-ink-600 hover:text-ink-800 transition-colors cursor-pointer">
                    Cancel
                  </button>
                  <button
                    onClick={() => { if (name.trim()) setStep('add-data'); }}
                    disabled={!name.trim()}
                    className={`px-6 py-2.5 rounded-xl text-[0.8125rem] font-semibold transition-colors cursor-pointer ${
                      name.trim() ? 'bg-brand-600 hover:bg-brand-500 text-white' : 'bg-ink-100 text-ink-400 cursor-not-allowed'
                    }`}
                  >
                    Next
                  </button>
                </>
              )}
              {isAddData && (
                <>
                  <p className="text-[0.75rem] text-ink-400 mr-auto">Pick sources or files to attach.</p>
                  <button onClick={handleClose} className="px-5 py-2.5 text-[0.8125rem] font-semibold text-ink-600 hover:text-ink-800 transition-colors cursor-pointer">
                    Cancel
                  </button>
                  {(activeTab === 'recent' || activeTab === 'saved') && (
                    <button
                      onClick={() => {
                        handleClose();
                        onOpenChat?.({ name, description });
                      }}
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
                      onClick={() => {
                        if (uploadedFile) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const text = ev.target?.result as string;
                            if (!text) return;
                            const lines = text.split('\n').filter(l => l.trim());
                            if (lines.length === 0) return;
                            const parseLine = (line: string) => {
                              const cells: string[] = [];
                              let current = '';
                              let inQuote = false;
                              for (const ch of line) {
                                if (ch === '"') { inQuote = !inQuote; }
                                else if (ch === ',' && !inQuote) { cells.push(current.trim()); current = ''; }
                                else { current += ch; }
                              }
                              cells.push(current.trim());
                              return cells;
                            };
                            const headers = parseLine(lines[0]);
                            const rows = lines.slice(1).map(parseLine);
                            setParsedHeaders(headers);
                            setParsedRows(rows);
                            const fname = uploadedFile.name.replace(/\.[^.]+$/, '');
                            setSheetNames([fname]);
                            setActiveSheet(fname);
                            setSelectedSheets([fname]);
                          };
                          reader.readAsText(uploadedFile);
                        }
                        setStep('navigator');
                      }}
                      disabled={!uploadedFile}
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
                      onClick={() => {
                        const source = allSources.find(s => s.id === selectedSource);
                        if (!source) return;
                        const isFile = source.type === 'file';
                        const isCsv = isFile && source.name.toLowerCase().endsWith('.csv');
                        const sourceType: DashboardSourceType = isFile ? (isCsv ? 'csv' : 'excel') : 'sql';
                        // Pass non-empty customFields so the dashboard auto-opens the
                        // Add Widget modal (DashboardView triggers on
                        // initialCustomFields.length). For files we use the canonical
                        // demo set; for SQL we flatten DB_SCHEMAS into a deduped column
                        // label list so the same trigger fires.
                        const customFields = isFile
                          ? ['Date', 'Region', 'Category', 'Vendor Name', 'Invoice Amount (₹)', 'Status', 'Department', 'Quantity']
                          : Array.from(new Set(
                              (DB_SCHEMAS[source.id] ?? []).flatMap(t => t.columns.map(c => c.label))
                            ));
                        onCreate(name, description, {
                          customFields,
                          sourceType,
                          sourceId: source.id,
                          sourceName: source.name,
                        });
                        handleClose();
                      }}
                      disabled={!selectedSource}
                      className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[0.8125rem] font-semibold transition-colors cursor-pointer ${
                        selectedSource ? 'bg-brand-600 hover:bg-brand-500 text-white' : 'bg-ink-100 text-ink-400 cursor-not-allowed'
                      }`}
                    >
                      <Check size={14} />
                      Attach
                    </button>
                  )}
                </>
              )}
              {isNavigator && (
                <>
                  <span className="text-[0.75rem] text-ink-500 mr-auto">{displayRows.length}{parsedRows.length > 50 ? ` of ${parsedRows.length}` : ''} rows</span>
                  <button onClick={() => setStep('add-data')} className="px-5 py-2.5 text-[0.8125rem] font-semibold text-ink-600 hover:text-ink-800 transition-colors cursor-pointer border border-canvas-border rounded-xl">
                    Back
                  </button>
                  <button
                    onClick={() => handleCreate(true)}
                    className="px-8 py-2.5 rounded-xl text-[0.8125rem] font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-colors cursor-pointer"
                  >
                    Load
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function DashboardListPage({ onDashboardClick, onImportPowerBI, createdDashboards = [], onCreateDashboard, onDeleteDashboard, onUpdateDashboardSource, onOpenChat, focusedDashboardId }: DashboardListPageProps) {
  const { can } = useCan();
  const { addToast } = useToast();
  const { openShare } = useShare();
  const [activeTab, setActiveTab] = useState<'my' | 'shared'>('my');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('recently');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  /** Dashboard id whose source is being changed via the kebab "Change data
   *  source" menu. Null when the picker is closed. */
  const [changeSourceDashboardId, setChangeSourceDashboardId] = useState<string | null>(null);
  const myDashboards = [...createdDashboards, ...MY_DASHBOARDS];
  const [sharedDashboards, setSharedDashboards] = useState(SHARED_DASHBOARDS);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const currentDashboards = activeTab === 'my' ? myDashboards : sharedDashboards;

  const filteredDashboards = currentDashboards
    .filter(d =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortOption) {
        case 'recently': return parseTimeAgo(a.timeAgo) - parseTimeAgo(b.timeAgo);
        case 'oldest': return parseTimeAgo(b.timeAgo) - parseTimeAgo(a.timeAgo);
        case 'nameAZ': return a.name.localeCompare(b.name);
        case 'nameZA': return b.name.localeCompare(a.name);
        default: return 0;
      }
    });

  const handleDelete = (id: string) => {
    if (activeTab === 'my') {
      onDeleteDashboard?.(id);
    } else {
      setSharedDashboards(prev => prev.filter(d => d.id !== id));
    }
    setDeleteConfirmId(null);
    setOpenMenuId(null);
    addToast({ message: 'Dashboard deleted', type: 'success' });
  };

  return (
    <div className="h-full overflow-y-auto bg-canvas">
      <div className="max-w-[1200px] mx-auto px-8 py-8">

        {/* ── Header ── */}
        <div className="mb-6">
          <div className="font-mono text-[0.75rem] text-ink-500 mb-2">Intelligence · Dashboards</div>
          <div className="flex items-end justify-between">
            <div>
              <h1 className="font-display text-[2.125rem] font-[420] text-ink-900 leading-[1.15]">Dashboards</h1>
              <p className="text-[0.8125rem] text-ink-500 mt-1">Manage and access all analytics dashboards</p>
            </div>
            <div className="flex items-center gap-2">
              {can('db_add') && (
                <button
                  onClick={() => setCreateModalOpen(true)}
                  className="flex items-center gap-2 px-4 h-10 bg-brand-600 hover:bg-brand-500 active:bg-brand-800 text-white rounded-md text-[0.8125rem] font-semibold transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                  Create Dashboard
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-6 border-b border-canvas-border mb-5">
          {(['my', 'shared'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-[0.8125rem] font-semibold relative transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === tab ? 'text-brand-700' : 'text-ink-500 hover:text-ink-700'
              }`}
            >
              {tab === 'my' ? 'My Dashboards' : 'Shared with Me'}
              {activeTab === tab && (
                <motion.div layoutId="dash-tab-underline" className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-600 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* ── Search & Sort ── */}
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex-1 max-w-sm relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              placeholder="Search dashboards..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-canvas-border rounded-md text-[0.8125rem] text-ink-800 placeholder:text-ink-400 bg-canvas-elevated focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100 transition-all"
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setSortMenuOpen(!sortMenuOpen)}
              className="flex items-center gap-2 px-3 h-9 border border-canvas-border bg-canvas-elevated rounded-md text-[0.8125rem] text-ink-700 hover:border-brand-200 transition-colors cursor-pointer"
            >
              {SORT_LABELS[sortOption]}
              <ChevronDown size={14} />
            </button>
            {sortMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSortMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 bg-canvas-elevated border border-canvas-border rounded-lg shadow-sm py-1 z-20 min-w-[180px]">
                  {(Object.keys(SORT_LABELS) as SortOption[]).map(option => (
                    <button
                      key={option}
                      onClick={() => { setSortOption(option); setSortMenuOpen(false); }}
                      className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-brand-50 text-[0.8125rem] text-ink-700 transition-colors cursor-pointer"
                    >
                      {sortOption === option ? <Check size={14} className="text-brand-600" /> : <div className="w-[14px]" />}
                      <span className={sortOption === option ? 'text-brand-700 font-medium' : ''}>{SORT_LABELS[option]}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Dashboard Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filteredDashboards.map((dashboard, i) => (
              <motion.div
                key={dashboard.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => onDashboardClick(dashboard.id)}
                className={`glass-card rounded-xl p-5 cursor-pointer group relative flex flex-col transition-shadow ${
                  focusedDashboardId === dashboard.id ? 'ring-2 ring-brand-400 shadow-lg' : ''
                }`}
              >
                {/* Context menu trigger */}
                <div className="absolute top-4 right-4 z-10">
                  <button
                    onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === dashboard.id ? null : dashboard.id); }}
                    className="p-1 rounded-md hover:bg-brand-50 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                  >
                    <MoreVertical size={16} className="text-ink-500" />
                  </button>
                  {openMenuId === dashboard.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={e => { e.stopPropagation(); setOpenMenuId(null); }} />
                      <div className="absolute right-0 top-full mt-1 bg-canvas-elevated border border-canvas-border rounded-lg shadow-sm py-1 z-20 min-w-[140px]">
                        <button
                          onClick={e => { e.stopPropagation(); openShare({ type: 'dashboard', id: dashboard.id, anchor: rectFromEvent(e) }); setOpenMenuId(null); }}
                          className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-brand-50 text-[0.8125rem] text-ink-700 transition-colors cursor-pointer"
                        >
                          <Share2 size={14} /> Share
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); addToast({ message: 'Dashboard exported.', type: 'success' }); setOpenMenuId(null); }}
                          className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-brand-50 text-[0.8125rem] text-ink-700 transition-colors cursor-pointer"
                        >
                          <Download size={14} /> Download
                        </button>
                        {/* Change data source — only on user-created dashboards in
                            the "my" tab (seed dashboards have hardcoded fixtures
                            and shared dashboards aren't ours to mutate). */}
                        {activeTab === 'my' && createdDashboards.some(d => d.id === dashboard.id) && (
                          <button
                            onClick={e => { e.stopPropagation(); setChangeSourceDashboardId(dashboard.id); setOpenMenuId(null); }}
                            className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-brand-50 text-[0.8125rem] text-ink-700 transition-colors cursor-pointer"
                          >
                            <Database size={14} /> Change data source
                          </button>
                        )}
                        <Gated permission="db_delete" mode="disable" title="You don't have permission to delete dashboards">
                        <button
                          onClick={e => { e.stopPropagation(); setDeleteConfirmId(dashboard.id); setOpenMenuId(null); }}
                          className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-risk-50 text-risk-700 text-[0.8125rem] transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} /> {activeTab === 'shared' ? 'Remove' : 'Delete'}
                        </button>
                        </Gated>
                      </div>
                    </>
                  )}
                </div>

                {/* Icon */}
                <div className="mb-4">
                  <div className={`inline-flex p-2.5 rounded-lg ${dashboard.accent}`}>
                    <LayoutGrid size={18} />
                  </div>
                </div>

                {/* Title & Description */}
                <div className="mb-4 flex-1">
                  <h3 className="text-[0.9375rem] font-semibold text-ink-900 group-hover:text-brand-700 transition-colors mb-1.5">
                    {dashboard.name}
                  </h3>
                  <p className="text-[0.75rem] text-ink-500 leading-relaxed line-clamp-2">
                    {dashboard.description}
                  </p>
                </div>

                {/* Shared by */}
                {dashboard.sharedBy && (
                  <div className="text-[0.6875rem] text-ink-400 mb-3">
                    Shared by <span className="font-medium text-ink-600">{dashboard.sharedBy}</span>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-canvas-border mt-auto">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <Clock size={13} className="text-ink-400" />
                      <span className="text-[0.75rem] text-ink-400">{dashboard.timeAgo}</span>
                    </div>
                    {(dashboard.dataSource || (dashboard.dataSourceNames && dashboard.dataSourceNames.length > 0)) && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {(() => {
                          // Prefer the explicit dataSource field. For combo dashboards
                          // (or legacy entries without it), fall back to inferring
                          // each badge from the individual data-source name.
                          const types = new Set<string>();
                          const ds = dashboard.dataSource;
                          if (ds === 'excel' || ds === 'csv') {
                            types.add('file');
                          } else if (ds === 'sql' || ds === 'query') {
                            types.add(ds);
                          } else {
                            (dashboard.dataSourceNames || []).forEach(name => {
                              if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) types.add('file');
                              else if (name.includes('query')) types.add('query');
                              else types.add('sql');
                            });
                          }
                          return Array.from(types).map(t => (
                            <span key={t} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.5625rem] font-semibold ${
                              t === 'file' ? 'bg-green-50 text-green-700' :
                              t === 'query' ? 'bg-amber-50 text-amber-700' :
                              'bg-purple-50 text-purple-700'
                            }`}>
                              {t === 'file' ? <Upload size={8} /> : <Database size={8} />}
                              {t === 'file' ? 'Excel / CSV' : t === 'query' ? 'Query' : 'SQL'}
                            </span>
                          ));
                        })()}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[0.75rem] font-semibold text-brand-600">Open</span>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M6 12L10 8L6 4" stroke="currentColor" className="text-brand-600" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Empty state */}
        {filteredDashboards.length === 0 && (
          <div className="text-center py-16">
            <div className="mx-auto mb-6 relative" style={{ width: 120, height: 120 }}>
              <div className="absolute inset-0 rounded-full bg-brand-50 animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                {activeTab === 'shared' ? <Share2 size={48} className="text-brand-300" /> : <LayoutGrid size={48} className="text-brand-300" />}
              </div>
            </div>
            <p className="text-[1rem] text-ink-700 font-semibold">
              {activeTab === 'shared' ? 'No shared dashboards' : searchQuery ? 'No dashboards found' : 'No dashboards yet'}
            </p>
            <p className="text-[0.8125rem] text-ink-400 mt-1.5 mb-5">
              {activeTab === 'shared'
                ? 'Dashboards shared with you by your team will appear here.'
                : searchQuery
                  ? 'Try a different search term or create a new dashboard.'
                  : 'Create your first dashboard to start visualizing your data.'}
            </p>
            {activeTab === 'my' && can('db_add') && (
              <button
                onClick={() => setCreateModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer"
              >
                <Plus size={14} />
                Create Dashboard
              </button>
            )}
          </div>
        )}

      {/* ── Sample Dashboards ── */}
      <div className="mt-8 mb-6">
        <h2 className="text-[0.8125rem] font-bold text-ink-500 uppercase tracking-wide mb-4">Sample Dashboards</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => onDashboardClick('excel')}
            className="glass-card rounded-xl p-5 cursor-pointer group relative flex flex-col"
          >
            {/* Icon */}
            <div className="mb-4">
              <div className="inline-flex p-2.5 rounded-lg bg-brand-50 text-brand-700">
                <FileText size={18} />
              </div>
            </div>

            {/* Title & Description */}
            <div className="mb-4 flex-1">
              <h3 className="text-[0.9375rem] font-semibold text-ink-900 group-hover:text-brand-700 transition-colors mb-1.5">
                Excel Sample Example
              </h3>
              <p className="text-[0.75rem] text-ink-500 leading-relaxed line-clamp-2">
                Excel data quality — blank cells, duplicate rows, type mismatches, format errors, and sheet-level anomalies.
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-canvas-border mt-auto">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Clock size={13} className="text-ink-400" />
                  <span className="text-[0.75rem] text-ink-400">30 minutes ago</span>
                </div>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.5625rem] font-semibold bg-green-50 text-green-700">
                  <Upload size={8} />
                  Excel
                </span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[0.75rem] font-semibold text-brand-600">Open</span>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M6 12L10 8L6 4" stroke="currentColor" className="text-brand-600" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </motion.div>

          {/* Live SQL — Vendor Risk (sample bound to db-02) */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            onClick={() => onDashboardClick('sql')}
            className="glass-card rounded-xl p-5 cursor-pointer group relative flex flex-col"
          >
            <div className="mb-4">
              <div className="inline-flex p-2.5 rounded-lg bg-purple-50 text-purple-700">
                <Database size={18} />
              </div>
            </div>
            <div className="mb-4 flex-1">
              <h3 className="text-[0.9375rem] font-semibold text-ink-900 group-hover:text-brand-700 transition-colors mb-1.5">
                Live SQL — Vendor Risk
              </h3>
              <p className="text-[0.75rem] text-ink-500 leading-relaxed line-clamp-2">
                Live database insights — vendor performance, invoice trends, risk distribution, and category-wise spend, sourced from Vendor Master (PostgreSQL).
              </p>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-canvas-border mt-auto">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Clock size={13} className="text-ink-400" />
                  <span className="text-[0.75rem] text-ink-400">Just now</span>
                </div>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.5625rem] font-semibold bg-purple-50 text-purple-700">
                  <Database size={8} />
                  SQL
                </span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[0.75rem] font-semibold text-brand-600">Open</span>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M6 12L10 8L6 4" stroke="currentColor" className="text-brand-600" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
      </div>

      {/* ── Delete Confirmation ── */}
      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setDeleteConfirmId(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="relative bg-canvas-elevated rounded-2xl border border-canvas-border shadow-2xl w-[360px] p-6 mx-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-[1rem] font-bold text-brand-900">
                  {activeTab === 'shared' ? 'Remove Dashboard?' : 'Delete Dashboard?'}
                </h3>
                <button onClick={() => setDeleteConfirmId(null)} className="p-1 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer shrink-0">
                  <X size={18} className="text-ink-400" />
                </button>
              </div>
              <p className="text-[0.8125rem] text-ink-500 mb-6 leading-relaxed">
                Are you sure you want to {activeTab === 'shared' ? 'remove' : 'delete'} this dashboard? This action cannot be undone and will remove all associated data.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-6 py-2.5 text-[0.8125rem] font-semibold text-ink-700 border border-canvas-border rounded-lg hover:bg-surface-2 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirmId)}
                  className="px-6 py-2.5 bg-risk text-white text-[0.8125rem] font-semibold rounded-lg hover:bg-risk-700 transition-colors cursor-pointer"
                >
                  {activeTab === 'shared' ? 'Remove' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Change data source picker ── */}
      <AnimatePresence>
        {changeSourceDashboardId && (() => {
          const target = createdDashboards.find(d => d.id === changeSourceDashboardId);
          if (!target) return null;
          const dbOptions = SEED.filter(s => s.type === 'database');
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setChangeSourceDashboardId(null)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                className="relative bg-canvas-elevated rounded-2xl border border-canvas-border shadow-2xl w-[440px] max-h-[80vh] flex flex-col mx-4"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-canvas-border">
                  <div>
                    <h3 className="text-[1rem] font-bold text-ink-900">Change data source</h3>
                    <p className="text-[0.75rem] text-ink-500 mt-0.5 truncate max-w-[340px]">For dashboard "{target.name}"</p>
                  </div>
                  <button onClick={() => setChangeSourceDashboardId(null)} className="p-1 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer shrink-0">
                    <X size={18} className="text-ink-400" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <div className="space-y-1.5">
                    {dbOptions.map(db => {
                      const cfg = INTEGRATION_CONFIGS[db.id];
                      const tableCount = (DB_SCHEMAS[db.id] ?? []).length;
                      const isCurrent = target.sourceId === db.id;
                      return (
                        <button
                          key={db.id}
                          onClick={() => {
                            onUpdateDashboardSource?.(target.id, {
                              dataSource: 'sql',
                              sourceId: db.id,
                              dataSourceNames: [db.name],
                            });
                            addToast({ message: `Source changed to ${db.name}`, type: 'success' });
                            setChangeSourceDashboardId(null);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer text-left ${
                            isCurrent ? 'border-brand-500 bg-brand-50' : 'border-canvas-border bg-canvas-elevated hover:border-brand-200'
                          }`}
                        >
                          <span className={`size-[8px] rounded-full shrink-0 ${
                            cfg?.health === 'healthy' ? 'bg-emerald-500' :
                            cfg?.health === 'degraded' ? 'bg-amber-500' :
                            cfg?.health === 'failed' ? 'bg-red-500' :
                            'bg-ink-300'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className={`text-[0.8125rem] truncate ${isCurrent ? 'text-brand-700 font-semibold' : 'text-ink-900 font-medium'}`}>{db.name}</div>
                            <div className="text-[0.6875rem] text-ink-400 truncate">
                              {cfg?.provider ?? 'Unknown provider'}
                              {tableCount > 0 && ` · ${tableCount} ${tableCount === 1 ? 'table' : 'tables'}`}
                            </div>
                          </div>
                          {isCurrent && <Check size={16} className="text-brand-600 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 px-6 py-3.5 border-t border-canvas-border">
                  <button onClick={() => setChangeSourceDashboardId(null)} className="px-5 py-2 text-[0.8125rem] font-semibold text-ink-700 hover:text-ink-900 transition-colors cursor-pointer">
                    Cancel
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Create Dashboard Modal */}
      <CreateDashboardModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onOpenChat={onOpenChat}
        onCreate={(name, desc, opts) => {
          const newId = `custom-${Date.now()}`;
          const newDashboard: Dashboard = {
            id: newId,
            name,
            description: desc || 'Custom dashboard',
            timeAgo: 'Just now',
            creator: 'You',
            accent: 'bg-brand-50 text-brand-700',
            ...(opts?.sourceType && { dataSource: opts.sourceType }),
            ...(opts?.sourceName && { dataSourceNames: [opts.sourceName] }),
            ...(opts?.sourceId && { sourceId: opts.sourceId }),
          };
          onCreateDashboard?.(newDashboard);
          addToast({ message: `Dashboard "${name}" created`, type: 'success' });
          onDashboardClick(newId, opts?.customFields);
        }}
      />
    </div>
  );
}
