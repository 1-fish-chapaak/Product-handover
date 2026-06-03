import { motion } from 'motion/react';
import {
  X, ChevronRight, CheckCircle2, Clock, AlertTriangle,
  FileText, Workflow, Shield, Database, Zap, Target,
  ArrowDown, ExternalLink, Eye, Filter, Upload, BarChart3
} from 'lucide-react';

interface TraceNode {
  level: number;
  type: string;
  icon: React.ElementType;
  label: string;
  id: string;
  status?: 'pass' | 'fail' | 'pending' | 'active';
  detail?: string;
  color: string;
  bg: string;
  clickable?: boolean;
}

const MOCK_TRACE: TraceNode[] = [
  { level: 0, type: 'engagement', icon: BarChart3, label: 'Engagement', id: 'ENG-2026-001', status: 'active', detail: 'P2P - SOX Audit FY2026', color: 'text-purple-600', bg: 'bg-purple-50', clickable: true },
  { level: 1, type: 'control', icon: Shield, label: 'Control', id: 'C-001', status: 'pass', detail: 'Credit Limit Approval', color: 'text-indigo-600', bg: 'bg-indigo-50', clickable: true },
  { level: 2, type: 'test-instance', icon: Zap, label: 'Test Instance', id: 'TI-001', status: 'pending', detail: 'Round 2 in progress', color: 'text-blue-600', bg: 'bg-blue-50', clickable: true },
  { level: 3, type: 'workflow', icon: Workflow, label: 'Workflow', id: 'WF-CLV-001', status: 'pending', detail: 'Credit Limit Validation v2.1', color: 'text-violet-600', bg: 'bg-violet-50', clickable: true },
  { level: 4, type: 'attribute', icon: Target, label: 'Attribute 1', id: 'ATTR-001', status: 'pass', detail: 'Approval Existence — 25/25 passed', color: 'text-cyan-600', bg: 'bg-cyan-50' },
  { level: 4, type: 'attribute', icon: Target, label: 'Attribute 2', id: 'ATTR-002', status: 'pass', detail: 'Dual Authorization — 25/25 passed', color: 'text-cyan-600', bg: 'bg-cyan-50' },
  { level: 4, type: 'attribute', icon: Target, label: 'Attribute 3', id: 'ATTR-003', status: 'pending', detail: 'Temporal Sequence — 22/25 (3 pending)', color: 'text-cyan-600', bg: 'bg-cyan-50' },
  { level: 4, type: 'attribute', icon: Target, label: 'Attribute 4', id: 'ATTR-004', status: 'pass', detail: 'Threshold Accuracy — 25/25 passed', color: 'text-cyan-600', bg: 'bg-cyan-50' },
  { level: 5, type: 'sample', icon: Filter, label: 'Sample', id: 'SMP-001', detail: '25 items selected from 1,247 population', color: 'text-teal-600', bg: 'bg-teal-50' },
  { level: 6, type: 'evidence', icon: FileText, label: 'Evidence', id: 'EVD-001', status: 'pass', detail: 'credit_approvals_q1.pdf', color: 'text-green-600', bg: 'bg-green-50', clickable: true },
  { level: 6, type: 'evidence', icon: FileText, label: 'Evidence', id: 'EVD-002', status: 'pass', detail: 'erp_activation_log.xlsx', color: 'text-green-600', bg: 'bg-green-50', clickable: true },
  { level: 7, type: 'working-paper', icon: Database, label: 'Working Paper', id: 'WP-001', status: 'pending', detail: 'Round 2 in progress, Round 1 locked', color: 'text-amber-600', bg: 'bg-amber-50', clickable: true },
  { level: 8, type: 'finding', icon: AlertTriangle, label: 'Finding', id: '-', detail: 'No findings generated (all attributes passing)', color: 'text-gray-400', bg: 'bg-gray-50' },
];

function StatusIcon({ status }: { status?: string }) {
  if (!status) return null;
  switch (status) {
    case 'pass': return <CheckCircle2 size={12} className="text-green-500" />;
    case 'fail': return <AlertTriangle size={12} className="text-red-500" />;
    case 'pending': return <Clock size={12} className="text-amber-500" />;
    case 'active': return <Zap size={12} className="text-blue-500" />;
    default: return null;
  }
}

interface Props {
  controlId?: string;
  onClose: () => void;
  onOpenWorkingPaper?: () => void;
  onOpenWorkflow?: () => void;
}

export default function TraceabilityPanel({ onClose, onOpenWorkingPaper, onOpenWorkflow }: Props) {
  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed right-0 top-0 bottom-0 w-[520px] bg-white border-l border-border-light shadow-2xl z-50 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-light bg-gradient-to-r from-purple-50/40 to-indigo-50/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
            <Shield size={18} className="text-purple-600" />
          </div>
          <div>
            <h2 className="text-[14px] font-bold text-text">Execution Trace</h2>
            <p className="text-[11px] text-text-muted">End-to-end audit trail</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onOpenWorkingPaper && (
            <button onClick={onOpenWorkingPaper} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border-light text-[11px] font-semibold text-text-secondary hover:bg-surface-2 transition-colors cursor-pointer">
              <FileText size={12} />
              Working Paper
            </button>
          )}
          {onOpenWorkflow && (
            <button onClick={onOpenWorkflow} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border-light text-[11px] font-semibold text-text-secondary hover:bg-surface-2 transition-colors cursor-pointer">
              <Workflow size={12} />
              Workflow
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-text-muted cursor-pointer">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="px-6 py-2.5 border-b border-border-light bg-surface-2/20">
        <div className="flex items-center gap-1.5 font-mono text-[12px]">
          <span className="text-primary font-semibold cursor-pointer hover:underline">Execution</span>
          <ChevronRight size={10} className="text-text-muted" />
          <span className="text-primary font-semibold cursor-pointer hover:underline">ENG-2026-001</span>
          <ChevronRight size={10} className="text-text-muted" />
          <span className="text-primary font-semibold cursor-pointer hover:underline">C-001</span>
          <ChevronRight size={10} className="text-text-muted" />
          <span className="text-text-secondary font-medium">TI-001</span>
        </div>
      </div>

      {/* Content - Trace Tree */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="space-y-0">
          {MOCK_TRACE.map((node, i) => {
            const prevLevel = i > 0 ? MOCK_TRACE[i - 1].level : -1;
            const nextLevel = i < MOCK_TRACE.length - 1 ? MOCK_TRACE[i + 1].level : -1;
            const showConnector = i < MOCK_TRACE.length - 1;
            const isChild = node.level > prevLevel && node.level === (i > 0 ? MOCK_TRACE[i - 1].level + 1 : 0);
            const isSibling = node.level === prevLevel;

            return (
              <div key={`${node.id}-${i}`}>
                {/* Connector */}
                {i > 0 && !isSibling && (
                  <div className="flex justify-center py-0.5" style={{ marginLeft: `${(node.level - 1) * 16}px` }}>
                    <ArrowDown size={10} className="text-border-light" />
                  </div>
                )}
                {isSibling && (
                  <div className="h-1" />
                )}

                {/* Node */}
                <div
                  className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-all ${
                    node.clickable ? 'hover:bg-surface-2/60 cursor-pointer' : ''
                  }`}
                  style={{ marginLeft: `${node.level * 16}px` }}
                  onClick={() => {
                    if (node.type === 'working-paper' && onOpenWorkingPaper) onOpenWorkingPaper();
                    if (node.type === 'workflow' && onOpenWorkflow) onOpenWorkflow();
                  }}
                >
                  <div className={`w-8 h-8 rounded-lg ${node.bg} flex items-center justify-center shrink-0`}>
                    <node.icon size={14} className={node.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-bold text-text">{node.label}</span>
                      <span className="text-[11px] font-mono text-text-muted">{node.id}</span>
                      <StatusIcon status={node.status} />
                    </div>
                    {node.detail && (
                      <p className="text-[11px] text-text-muted truncate">{node.detail}</p>
                    )}
                  </div>
                  {node.clickable && (
                    <ExternalLink size={11} className="text-text-muted shrink-0" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-8 p-4 rounded-xl border border-border-light bg-surface-2/20">
          <h4 className="text-[11px] font-bold text-text-muted uppercase mb-2">Status Legend</h4>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: <CheckCircle2 size={11} className="text-green-500" />, label: 'Pass / Complete' },
              { icon: <AlertTriangle size={11} className="text-red-500" />, label: 'Fail / Exception' },
              { icon: <Clock size={11} className="text-amber-500" />, label: 'Pending / In Progress' },
              { icon: <Zap size={11} className="text-blue-500" />, label: 'Active' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5">
                {item.icon}
                <span className="text-[11px] text-text-muted">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Forward / Backward Trace Summary */}
        <div className="mt-4 p-4 rounded-xl border border-border-light bg-gradient-to-br from-indigo-50/30 to-purple-50/30">
          <h4 className="text-[11px] font-bold text-text-muted uppercase mb-2">Trace Summary</h4>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-text-secondary">Total Attributes Tested</span>
              <span className="font-bold text-text">4</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-text-secondary">Attributes Passed</span>
              <span className="font-bold text-green-600">3</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-text-secondary">Attributes Pending</span>
              <span className="font-bold text-amber-600">1</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-text-secondary">Evidence Items</span>
              <span className="font-bold text-text">2</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-text-secondary">Testing Rounds</span>
              <span className="font-bold text-text">2 (1 locked, 1 active)</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-text-secondary">Findings Generated</span>
              <span className="font-bold text-gray-400">0</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
