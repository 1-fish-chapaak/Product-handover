import { useState } from 'react';
import {
  Search, Upload, FileSpreadsheet, FileText, File,
  Download, Eye, Sparkles, Shield,
  ChevronRight, CloudUpload, X, CheckCircle2,
  Clock, XCircle, Workflow, Database, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Orb from '../shared/Orb';

type ActiveTab = 'evidence' | 'working-papers';

// ── Evidence Tab Data ──

interface EvidenceRow {
  id: string;
  name: string;
  source: string;
  type: string;
  linkedControl: string;
  linkedSample: string;
  linkedAttribute: string;
  linkedTestInstance: string;
  engagement: string;
  size: string;
  status: 'Verified' | 'Pending Review' | 'Rejected' | 'Uploaded';
  fileType: 'xlsx' | 'csv' | 'pdf';
}

const EVIDENCE_ROWS: EvidenceRow[] = [
  {
    id: 'evd-1', name: 'credit_approvals_q1.pdf', source: 'Manual Upload', type: 'Approval Document',
    linkedControl: 'C-001', linkedSample: 'SMP-001 (25 items)', linkedAttribute: 'Approval Existence',
    linkedTestInstance: 'TI-001', engagement: 'ENG-2026-001', size: '8.4 MB',
    status: 'Verified', fileType: 'pdf',
  },
  {
    id: 'evd-2', name: 'erp_activation_log.xlsx', source: 'SAP ERP', type: 'System Log',
    linkedControl: 'C-001', linkedSample: 'SMP-001 (25 items)', linkedAttribute: 'Temporal Sequence',
    linkedTestInstance: 'TI-001', engagement: 'ENG-2026-001', size: '2.3 MB',
    status: 'Verified', fileType: 'xlsx',
  },
  {
    id: 'evd-3', name: 'vendor_change_screenshots.pdf', source: 'Manual Upload', type: 'Screenshot',
    linkedControl: 'C-002', linkedSample: 'SMP-003 (30 items)', linkedAttribute: 'Verification Callback',
    linkedTestInstance: 'TI-002', engagement: 'ENG-2026-001', size: '12.1 MB',
    status: 'Pending Review', fileType: 'pdf',
  },
  {
    id: 'evd-4', name: 'po_match_report_q1.xlsx', source: 'SAP ERP', type: 'Match Report',
    linkedControl: 'C-003', linkedSample: 'SMP-005 (40 items)', linkedAttribute: '3-Way Match Validation',
    linkedTestInstance: 'TI-003', engagement: 'ENG-2026-001', size: '5.7 MB',
    status: 'Verified', fileType: 'xlsx',
  },
  {
    id: 'evd-5', name: 'access_recert_q4.pdf', source: 'Workday', type: 'Recertification Report',
    linkedControl: 'C-005', linkedSample: 'SMP-008 (15 items)', linkedAttribute: 'Access Validated',
    linkedTestInstance: 'TI-005', engagement: 'ENG-2026-001', size: '3.2 MB',
    status: 'Rejected', fileType: 'pdf',
  },
  {
    id: 'evd-6', name: 'credit_approvals_q2.pdf', source: 'Manual Upload', type: 'Approval Document',
    linkedControl: 'C-001', linkedSample: 'SMP-010 (25 items)', linkedAttribute: 'Approval Existence',
    linkedTestInstance: 'TI-001', engagement: 'ENG-2026-001', size: '9.1 MB',
    status: 'Uploaded', fileType: 'pdf',
  },
];

// ── Working Papers Tab Data ──

interface WorkingPaperRow {
  id: string;
  testInstanceId: string;
  engagement: string;
  controlId: string;
  controlName: string;
  workflowName: string;
  latestRound: number;
  totalRounds: number;
  reviewerStatus: 'Approved' | 'Pending Review' | 'Rejected' | 'Not Started';
  conclusion: 'Effective' | 'Ineffective' | 'Pending' | '';
  lastUpdated: string;
}

const WORKING_PAPER_ROWS: WorkingPaperRow[] = [
  { id: 'wp-1', testInstanceId: 'TI-001', engagement: 'ENG-2026-001', controlId: 'C-001', controlName: 'Credit Limit Approval', workflowName: 'Credit Limit Validation v2.1', latestRound: 2, totalRounds: 2, reviewerStatus: 'Pending Review', conclusion: 'Pending', lastUpdated: 'Apr 10, 2026' },
  { id: 'wp-2', testInstanceId: 'TI-002', engagement: 'ENG-2026-001', controlId: 'C-002', controlName: 'Vendor Review', workflowName: 'Vendor Master Validation v1.3', latestRound: 1, totalRounds: 1, reviewerStatus: 'Not Started', conclusion: 'Pending', lastUpdated: 'Apr 8, 2026' },
  { id: 'wp-3', testInstanceId: 'TI-003', engagement: 'ENG-2026-001', controlId: 'C-003', controlName: '3-Way Match', workflowName: '3-Way PO Match v2.0', latestRound: 2, totalRounds: 2, reviewerStatus: 'Approved', conclusion: 'Effective', lastUpdated: 'Apr 5, 2026' },
  { id: 'wp-4', testInstanceId: 'TI-005', engagement: 'ENG-2026-001', controlId: 'C-005', controlName: 'Access Recertification', workflowName: 'Access Review v1.1', latestRound: 1, totalRounds: 1, reviewerStatus: 'Rejected', conclusion: 'Ineffective', lastUpdated: 'Apr 3, 2026' },
];

// ── Shared Components ──

function FileIcon({ type }: { type: 'xlsx' | 'csv' | 'pdf' }) {
  const config = {
    xlsx: { icon: FileSpreadsheet, color: 'text-green-600', bg: 'bg-green-50' },
    csv: { icon: File, color: 'text-blue-600', bg: 'bg-blue-50' },
    pdf: { icon: FileText, color: 'text-red-600', bg: 'bg-red-50' },
  };
  const c = config[type];
  const Icon = c.icon;
  return (
    <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
      <Icon size={16} className={c.color} />
    </div>
  );
}

function EvidenceStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    'Verified': { bg: 'bg-green-50', text: 'text-green-700', icon: <CheckCircle2 size={11} /> },
    'Uploaded': { bg: 'bg-blue-50', text: 'text-blue-700', icon: <CloudUpload size={11} /> },
    'Pending Review': { bg: 'bg-amber-50', text: 'text-amber-700', icon: <Clock size={11} /> },
    'Rejected': { bg: 'bg-red-50', text: 'text-red-700', icon: <XCircle size={11} /> },
  };
  const s = map[status] || map['Pending Review'];
  return (
    <span className={`inline-flex items-center gap-1 ${s.bg} ${s.text} px-2 py-0.5 rounded-full text-[0.75rem] font-bold whitespace-nowrap`}>
      {s.icon}
      {status}
    </span>
  );
}

function ReviewerStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    'Approved': { bg: 'bg-green-50', text: 'text-green-700', icon: <CheckCircle2 size={11} /> },
    'Pending Review': { bg: 'bg-amber-50', text: 'text-amber-700', icon: <Clock size={11} /> },
    'Rejected': { bg: 'bg-red-50', text: 'text-red-700', icon: <XCircle size={11} /> },
    'Not Started': { bg: 'bg-gray-100', text: 'text-gray-500', icon: null },
  };
  const s = map[status] || map['Not Started'];
  return (
    <span className={`inline-flex items-center gap-1 ${s.bg} ${s.text} px-2 py-0.5 rounded-full text-[0.75rem] font-bold whitespace-nowrap`}>
      {s.icon}
      {status}
    </span>
  );
}

function ConclusionBadge({ conclusion }: { conclusion: string }) {
  if (!conclusion) return <span className="text-gray-300 text-[0.75rem]">-</span>;
  const map: Record<string, { bg: string; text: string }> = {
    'Effective': { bg: 'bg-green-50', text: 'text-green-700' },
    'Ineffective': { bg: 'bg-red-50', text: 'text-red-700' },
    'Pending': { bg: 'bg-amber-50', text: 'text-amber-700' },
  };
  const s = map[conclusion] || map['Pending'];
  return (
    <span className={`inline-flex items-center gap-1 ${s.bg} ${s.text} px-2 py-0.5 rounded-full text-[0.75rem] font-bold`}>
      {conclusion}
    </span>
  );
}

interface Props {
  onOpenWorkingPaper?: (controlId: string) => void;
  onOpenWorkflow?: (controlId: string) => void;
  onOpenTrace?: (controlId: string) => void;
}

export default function EvidenceView({ onOpenWorkingPaper, onOpenWorkflow, onOpenTrace }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('evidence');
  const [search, setSearch] = useState('');
  const [dragOver, setDragOver] = useState(false);

  // ── Evidence tab filter ──
  const filteredEvidence = EVIDENCE_ROWS.filter(f => {
    if (!search) return true;
    const q = search.toLowerCase();
    return f.name.toLowerCase().includes(q) || f.linkedControl.toLowerCase().includes(q) || f.linkedAttribute.toLowerCase().includes(q) || f.type.toLowerCase().includes(q);
  });

  // ── Working Papers tab filter ──
  const filteredWPs = WORKING_PAPER_ROWS.filter(f => {
    if (!search) return true;
    const q = search.toLowerCase();
    return f.controlId.toLowerCase().includes(q) || f.controlName.toLowerCase().includes(q) || f.workflowName.toLowerCase().includes(q) || f.engagement.toLowerCase().includes(q);
  });

  return (
    <div className="h-full overflow-y-auto bg-white bg-mesh-gradient relative">
      <Orb hoverIntensity={0.09} rotateOnHover hue={160} opacity={0.08} />
      <div className="px-10 py-8 relative">
        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-text">Evidence & Workpapers</h1>
            <p className="text-sm text-text-secondary mt-1">Manage evidence artifacts and working paper documentation.</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-2 border border-border-light bg-white text-text-secondary rounded-lg text-[0.75rem] font-medium hover:shadow-md hover:border-primary/20 transition-all cursor-pointer">
              <Sparkles size={14} className="text-purple-500" />
              Analyze with AI
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer">
              <Upload size={14} />
              Upload File
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-surface-2/50 rounded-xl p-1 w-fit">
          <button
            onClick={() => { setActiveTab('evidence'); setSearch(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[0.8125rem] font-semibold transition-all cursor-pointer ${
              activeTab === 'evidence'
                ? 'bg-white text-primary shadow-sm'
                : 'text-text-muted hover:text-text'
            }`}
          >
            <FileText size={14} />
            Evidence
            <span className={`text-[0.6875rem] font-bold px-1.5 py-0.5 rounded-full ${activeTab === 'evidence' ? 'bg-primary/10 text-primary' : 'bg-gray-200 text-gray-500'}`}>
              {EVIDENCE_ROWS.length}
            </span>
          </button>
          <button
            onClick={() => { setActiveTab('working-papers'); setSearch(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[0.8125rem] font-semibold transition-all cursor-pointer ${
              activeTab === 'working-papers'
                ? 'bg-white text-primary shadow-sm'
                : 'text-text-muted hover:text-text'
            }`}
          >
            <Database size={14} />
            Working Papers
            <span className={`text-[0.6875rem] font-bold px-1.5 py-0.5 rounded-full ${activeTab === 'working-papers' ? 'bg-primary/10 text-primary' : 'bg-gray-200 text-gray-500'}`}>
              {WORKING_PAPER_ROWS.length}
            </span>
          </button>
        </div>

        {/* Summary Cards */}
        {activeTab === 'evidence' ? (
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Evidence', value: String(EVIDENCE_ROWS.length), color: 'text-text' },
              { label: 'Verified', value: String(EVIDENCE_ROWS.filter(e => e.status === 'Verified').length), color: 'text-success' },
              { label: 'Pending Review', value: String(EVIDENCE_ROWS.filter(e => e.status === 'Pending Review').length), color: 'text-warning' },
              { label: 'Rejected', value: String(EVIDENCE_ROWS.filter(e => e.status === 'Rejected').length), color: 'text-danger' },
            ].map(card => (
              <div key={card.label} className="bg-white rounded-xl border border-border-light p-3 text-center hover:shadow-md transition-all duration-200">
                <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
                <div className="text-[0.75rem] text-text-muted uppercaser">{card.label}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Working Papers', value: String(WORKING_PAPER_ROWS.length), color: 'text-text' },
              { label: 'Approved', value: String(WORKING_PAPER_ROWS.filter(w => w.reviewerStatus === 'Approved').length), color: 'text-success' },
              { label: 'Pending Review', value: String(WORKING_PAPER_ROWS.filter(w => w.reviewerStatus === 'Pending Review').length), color: 'text-warning' },
              { label: 'Rejected', value: String(WORKING_PAPER_ROWS.filter(w => w.reviewerStatus === 'Rejected').length), color: 'text-danger' },
            ].map(card => (
              <div key={card.label} className="bg-white rounded-xl border border-border-light p-3 text-center hover:shadow-md transition-all duration-200">
                <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
                <div className="text-[0.75rem] text-text-muted uppercaser">{card.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Drag & Drop Zone (Evidence tab only) */}
        {activeTab === 'evidence' && (
          <motion.div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); }}
            animate={dragOver ? { scale: 1.01, borderColor: 'var(--color-primary)' } : { scale: 1 }}
            className={`relative mb-6 rounded-xl border-2 border-dashed transition-colors ${
              dragOver
                ? 'border-primary bg-primary/5'
                : 'border-border-light bg-surface-2/30 hover:border-primary/30'
            }`}
          >
            <div className="flex flex-col items-center justify-center py-6">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 transition-colors ${
                dragOver ? 'bg-primary/10' : 'bg-gray-100'
              }`}>
                <CloudUpload size={20} className={dragOver ? 'text-primary' : 'text-text-muted'} />
              </div>
              <p className="text-[0.8125rem] font-medium text-text">
                Drop evidence files here or{' '}
                <span className="text-primary cursor-pointer hover:underline">browse</span>
              </p>
              <p className="text-[0.75rem] text-text-muted mt-1">Supports XLSX, CSV, PDF, XML up to 500 MB</p>
            </div>
          </motion.div>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder={activeTab === 'evidence' ? 'Search evidence by name, control, or attribute...' : 'Search working papers by control, workflow, or engagement...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-[0.8125rem] bg-white border border-border-light rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all placeholder:text-text-muted"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text cursor-pointer">
              <X size={14} />
            </button>
          )}
        </div>

        {/* ── Evidence Table ── */}
        {activeTab === 'evidence' && (
          <div className="bg-white rounded-xl border border-border-light overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[0.75rem]">
                <thead>
                  <tr className="border-b border-border-light bg-surface-2/50">
                    {['File Name', 'Source', 'Type', 'Linked Control', 'Sample', 'Attribute', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-3 py-3 text-left text-[0.75rem] font-semibold text-text-muted uppercaser">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filteredEvidence.map((row, i) => (
                      <motion.tr
                        key={row.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2, delay: i * 0.03 }}
                        className="border-b border-border-light/60 hover:bg-surface-2/40 transition-colors group"
                      >
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2.5">
                            <FileIcon type={row.fileType} />
                            <span className="text-text font-medium text-[0.75rem]">{row.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`text-[0.75rem] font-medium ${row.source === 'Manual Upload' ? 'text-text-muted' : 'text-indigo-600'}`}>
                            {row.source}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-[0.75rem] text-text-secondary bg-gray-50 px-1.5 py-0.5 rounded font-medium">{row.type}</span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-[0.75rem] font-mono text-primary bg-primary/5 px-1.5 py-0.5 rounded-md border border-primary/10 cursor-pointer hover:bg-primary/10">{row.linkedControl}</span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-[0.6875rem] text-text-muted">{row.linkedSample}</span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-[0.6875rem] text-text-secondary font-medium">{row.linkedAttribute}</span>
                        </td>
                        <td className="px-3 py-3">
                          <EvidenceStatusBadge status={row.status} />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <button className="p-1 rounded hover:bg-gray-100 text-text-muted hover:text-primary cursor-pointer" title="View">
                              <Eye size={12} />
                            </button>
                            <button className="p-1 rounded hover:bg-gray-100 text-text-muted hover:text-primary cursor-pointer" title="Download">
                              <Download size={12} />
                            </button>
                            <button
                              onClick={() => onOpenTrace?.(row.linkedControl)}
                              className="p-1 rounded hover:bg-gray-100 text-text-muted hover:text-purple-600 cursor-pointer"
                              title="View Trace"
                            >
                              <Shield size={12} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t border-border-light bg-surface-2/30">
              <span className="text-[0.75rem] text-text-muted">Showing {filteredEvidence.length} of {EVIDENCE_ROWS.length} evidence items</span>
              <div className="flex items-center gap-1">
                <span className="text-[0.75rem] text-text-muted">Page 1 of 1</span>
                <button className="p-1 rounded hover:bg-gray-100 text-text-muted cursor-pointer"><ChevronRight size={14} /></button>
              </div>
            </div>
          </div>
        )}

        {/* ── Working Papers Table ── */}
        {activeTab === 'working-papers' && (
          <div className="bg-white rounded-xl border border-border-light overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[0.75rem]">
                <thead>
                  <tr className="border-b border-border-light bg-surface-2/50">
                    {['Control', 'Engagement', 'Workflow', 'Rounds', 'Reviewer Status', 'Conclusion', 'Last Updated', 'Actions'].map(h => (
                      <th key={h} className="px-3 py-3 text-left text-[0.75rem] font-semibold text-text-muted uppercaser">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filteredWPs.map((row, i) => (
                      <motion.tr
                        key={row.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2, delay: i * 0.03 }}
                        className="border-b border-border-light/60 hover:bg-surface-2/40 transition-colors group"
                      >
                        <td className="px-3 py-3">
                          <div className="flex flex-col">
                            <span className="font-mono text-[0.6875rem] text-text-muted">{row.controlId}</span>
                            <span className="text-text font-medium text-[0.75rem]">{row.controlName}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-text-secondary font-mono text-[0.75rem] bg-gray-50 px-1.5 py-0.5 rounded">{row.engagement}</span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <Workflow size={11} className="text-indigo-500" />
                            <span className="text-[0.75rem] text-indigo-700 font-medium">{row.workflowName}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-[0.75rem] font-medium text-text-secondary">
                            Round {row.latestRound}/{row.totalRounds}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <ReviewerStatusBadge status={row.reviewerStatus} />
                        </td>
                        <td className="px-3 py-3">
                          <ConclusionBadge conclusion={row.conclusion} />
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-[0.75rem] text-text-muted">{row.lastUpdated}</span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => onOpenWorkingPaper?.(row.controlId)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[0.6875rem] font-semibold text-primary bg-primary/5 hover:bg-primary/10 border border-primary/10 transition-all cursor-pointer"
                            >
                              <Eye size={10} />
                              View
                            </button>
                            <button
                              onClick={() => onOpenWorkflow?.(row.controlId)}
                              className="p-1 rounded hover:bg-gray-100 text-text-muted hover:text-indigo-600 cursor-pointer"
                              title="View Workflow"
                            >
                              <Workflow size={12} />
                            </button>
                            <button
                              onClick={() => onOpenTrace?.(row.controlId)}
                              className="p-1 rounded hover:bg-gray-100 text-text-muted hover:text-purple-600 cursor-pointer"
                              title="View Trace"
                            >
                              <Shield size={12} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t border-border-light bg-surface-2/30">
              <span className="text-[0.75rem] text-text-muted">Showing {filteredWPs.length} of {WORKING_PAPER_ROWS.length} working papers</span>
              <div className="flex items-center gap-1">
                <span className="text-[0.75rem] text-text-muted">Page 1 of 1</span>
                <button className="p-1 rounded hover:bg-gray-100 text-text-muted cursor-pointer"><ChevronRight size={14} /></button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
