import { useState } from 'react';
import { motion } from 'motion/react';
import {
  X, Workflow, ChevronDown, ChevronRight, CheckCircle2,
  Clock, AlertTriangle, Database, FileText, ArrowDown,
  Zap, Eye, Shield, Upload, Filter, BarChart3, Target
} from 'lucide-react';

interface WorkflowAttribute {
  id: string;
  name: string;
  description: string;
  requiredEvidence: string;
  dataDependency: string;
  result: 'pass' | 'fail' | 'pending' | 'na';
  passRate: string;
  logic: string;
}

interface WorkflowExecutionData {
  workflowId: string;
  name: string;
  version: string;
  type: string;
  status: 'complete' | 'in-progress' | 'not-started';
  engagement: string;
  controlId: string;
  controlName: string;
  executionDate: string;
  attributes: WorkflowAttribute[];
  inputSources: { name: string; type: string; rows: string }[];
  overallResult: 'pass' | 'fail' | 'pending';
}

const MOCK_WORKFLOW_EXECUTION: WorkflowExecutionData = {
  workflowId: 'WF-CLV-001',
  name: 'Credit Limit Validation',
  version: 'v2.1',
  type: 'Compliance',
  status: 'in-progress',
  engagement: 'ENG-2026-001',
  controlId: 'C-001',
  controlName: 'Credit Limit Approval',
  executionDate: 'Apr 10, 2026',
  attributes: [
    {
      id: 'attr-1',
      name: 'Approval Existence',
      description: 'Verify that a documented approval exists for each credit limit change exceeding the threshold',
      requiredEvidence: 'Approval document, email confirmation, or system screenshot',
      dataDependency: 'credit_approvals_q1.pdf, erp_activation_log.xlsx',
      result: 'pass',
      passRate: '25/25 (100%)',
      logic: 'IF approval_document EXISTS AND approval_date <= activation_date THEN PASS',
    },
    {
      id: 'attr-2',
      name: 'Dual Authorization',
      description: 'Confirm both Credit Manager and Finance Director have signed off on the change',
      requiredEvidence: 'Dual signature evidence, system approval log',
      dataDependency: 'approval_matrix.xlsx',
      result: 'pass',
      passRate: '25/25 (100%)',
      logic: 'IF signatory_count >= 2 AND signatory_roles INCLUDE ("Credit Manager", "Finance Director") THEN PASS',
    },
    {
      id: 'attr-3',
      name: 'Temporal Sequence',
      description: 'Ensure approval timestamp precedes ERP system activation timestamp',
      requiredEvidence: 'System timestamps from approval and activation logs',
      dataDependency: 'erp_activation_log.xlsx',
      result: 'pending',
      passRate: '22/25 (88%)',
      logic: 'IF approval_timestamp < activation_timestamp THEN PASS',
    },
    {
      id: 'attr-4',
      name: 'Threshold Accuracy',
      description: 'Validate that all transactions exceeding $50K materiality threshold were correctly identified and routed for approval',
      requiredEvidence: 'Transaction register, threshold configuration screenshot',
      dataDependency: 'ap_transactions_q1.xlsx',
      result: 'pass',
      passRate: '25/25 (100%)',
      logic: 'IF transaction_amount > 50000 AND approval_required = TRUE THEN PASS',
    },
  ],
  inputSources: [
    { name: 'ap_transactions_q1.xlsx', type: 'Population', rows: '1,247,832' },
    { name: 'credit_approvals_q1.pdf', type: 'Evidence', rows: '-' },
    { name: 'erp_activation_log.xlsx', type: 'System Log', rows: '4,521' },
    { name: 'approval_matrix.xlsx', type: 'Master Data', rows: '234' },
  ],
  overallResult: 'pending',
};

function AttrResultBadge({ result }: { result: string }) {
  const map: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    pass: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', icon: <CheckCircle2 size={11} /> },
    fail: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', icon: <AlertTriangle size={11} /> },
    pending: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: <Clock size={11} /> },
    na: { bg: 'bg-canvas border-canvas-border', text: 'text-ink-500', icon: null },
  };
  const s = map[result] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 ${s.bg} ${s.text} border px-2.5 py-1 rounded-full text-[0.6875rem] font-bold uppercase`}>
      {s.icon}
      {result}
    </span>
  );
}

interface Props {
  controlId?: string;
  onClose: () => void;
  onViewWorkingPaper?: () => void;
  onViewTrace?: () => void;
}

export default function WorkflowExecutionPanel({ onClose, onViewWorkingPaper, onViewTrace }: Props) {
  const wf = MOCK_WORKFLOW_EXECUTION;
  const [expandedAttr, setExpandedAttr] = useState<string | null>(null);
  const [showLineage, setShowLineage] = useState(false);

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed right-0 top-0 bottom-0 w-[560px] bg-white border-l border-border-light shadow-2xl z-50 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-light bg-indigo-50/30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Workflow size={18} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="text-[0.875rem] font-bold text-text">Workflow Execution</h2>
            <p className="text-[0.6875rem] text-text-muted">
              <span className="font-mono">{wf.workflowId}</span> &middot; {wf.version} &middot;
              <span className="font-semibold text-indigo-600"> {wf.type}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onViewWorkingPaper && (
            <button onClick={onViewWorkingPaper} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border-light text-[0.6875rem] font-semibold text-text-secondary hover:bg-surface-2 transition-colors cursor-pointer">
              <FileText size={12} />
              Working Paper
            </button>
          )}
          {onViewTrace && (
            <button onClick={onViewTrace} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border-light text-[0.6875rem] font-semibold text-text-secondary hover:bg-surface-2 transition-colors cursor-pointer">
              <Shield size={12} />
              Trace
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-canvas text-text-muted cursor-pointer">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Workflow Summary */}
        <div className="px-6 py-4 border-b border-border-light">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[0.625rem] text-text-muted uppercase">Workflow</span>
              <p className="text-[0.8125rem] font-bold text-indigo-700">{wf.name}</p>
            </div>
            <div>
              <span className="text-[0.625rem] text-text-muted uppercase">Status</span>
              <div className="mt-0.5">
                <AttrResultBadge result={wf.status === 'complete' ? 'pass' : wf.status === 'in-progress' ? 'pending' : 'na'} />
              </div>
            </div>
            <div>
              <span className="text-[0.625rem] text-text-muted uppercase">Control</span>
              <p className="text-[0.75rem] text-text-secondary">
                <span className="font-mono text-primary">{wf.controlId}</span> &middot; {wf.controlName}
              </p>
            </div>
            <div>
              <span className="text-[0.625rem] text-text-muted uppercase">Execution Date</span>
              <p className="text-[0.75rem] text-text-secondary">{wf.executionDate}</p>
            </div>
          </div>
        </div>

        {/* Input Sources */}
        <div className="px-6 py-4 border-b border-border-light">
          <h3 className="text-[0.75rem] font-bold text-text-muted uppercase mb-3 flex items-center gap-1.5">
            <Database size={12} />
            Input Sources
          </h3>
          <div className="space-y-1.5">
            {wf.inputSources.map(src => (
              <div key={src.name} className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-2/40 hover:bg-surface-2/70 transition-colors">
                <div className="flex items-center gap-2">
                  <Upload size={11} className="text-text-muted" />
                  <span className="text-[0.75rem] font-medium text-text">{src.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[0.6875rem] text-text-muted bg-canvas px-1.5 py-0.5 rounded">{src.type}</span>
                  <span className="text-[0.6875rem] text-text-muted tabular-nums">{src.rows} rows</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Attributes (Test Steps) */}
        <div className="px-6 py-4 border-b border-border-light">
          <h3 className="text-[0.75rem] font-bold text-text-muted uppercase mb-3 flex items-center gap-1.5">
            <Target size={12} />
            Attributes ({wf.attributes.length} test steps)
          </h3>
          <div className="space-y-2">
            {wf.attributes.map((attr, i) => {
              const isExpanded = expandedAttr === attr.id;
              return (
                <div key={attr.id} className="rounded-xl border border-border-light overflow-hidden">
                  <button
                    onClick={() => setExpandedAttr(isExpanded ? null : attr.id)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-2/30 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown size={12} className="text-text-muted" /> : <ChevronRight size={12} className="text-text-muted" />}
                      <div className="text-left">
                        <span className="text-[0.625rem] text-text-muted font-mono">Step {i + 1}</span>
                        <p className="text-[0.75rem] font-semibold text-text">{attr.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[0.6875rem] text-text-muted tabular-nums">{attr.passRate}</span>
                      <AttrResultBadge result={attr.result} />
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-border-light/60 space-y-3 pt-3">
                      <div>
                        <span className="text-[0.625rem] text-text-muted uppercase font-bold">What it checks</span>
                        <p className="text-[0.75rem] text-text-secondary leading-relaxed mt-0.5">{attr.description}</p>
                      </div>
                      <div>
                        <span className="text-[0.625rem] text-text-muted uppercase font-bold">Logic</span>
                        <p className="text-[0.6875rem] font-mono text-indigo-700 bg-indigo-50/50 p-2 rounded-lg mt-0.5 leading-relaxed">{attr.logic}</p>
                      </div>
                      <div>
                        <span className="text-[0.625rem] text-text-muted uppercase font-bold">Required Evidence</span>
                        <p className="text-[0.75rem] text-text-secondary mt-0.5">{attr.requiredEvidence}</p>
                      </div>
                      <div>
                        <span className="text-[0.625rem] text-text-muted uppercase font-bold">Data Dependency</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {attr.dataDependency.split(', ').map(dep => (
                            <span key={dep} className="text-[0.6875rem] font-mono text-primary bg-primary/5 px-2 py-0.5 rounded-md border border-primary/10">
                              {dep}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Data Lineage */}
        <div className="px-6 py-4">
          <button
            onClick={() => setShowLineage(!showLineage)}
            className="flex items-center gap-2 text-[0.75rem] font-bold text-text-muted uppercase mb-3 cursor-pointer hover:text-text transition-colors"
          >
            {showLineage ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <BarChart3 size={12} />
            Data Lineage
          </button>

          {showLineage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-0"
            >
              {[
                { icon: Upload, label: 'File Upload', detail: 'ap_transactions_q1.xlsx', color: 'text-blue-600', bg: 'bg-blue-50' },
                { icon: Database, label: 'Population Snapshot', detail: '1,247,832 records', color: 'text-purple-600', bg: 'bg-purple-50' },
                { icon: Zap, label: 'Test Instance', detail: 'TI-001 / C-001', color: 'text-indigo-600', bg: 'bg-indigo-50' },
                { icon: Workflow, label: 'Workflow', detail: 'Credit Limit Validation v2.1', color: 'text-violet-600', bg: 'bg-violet-50' },
                { icon: Filter, label: 'Attributes', detail: '4 test steps applied', color: 'text-cyan-600', bg: 'bg-cyan-50' },
                { icon: CheckCircle2, label: 'Result', detail: '3 Pass / 1 Pending', color: 'text-green-600', bg: 'bg-green-50' },
                { icon: Target, label: 'Conclusion', detail: 'Pending (Round 2)', color: 'text-amber-600', bg: 'bg-amber-50' },
                { icon: AlertTriangle, label: 'Finding', detail: 'None generated', color: 'text-ink-500', bg: 'bg-canvas' },
              ].map((step, i, arr) => (
                <div key={step.label}>
                  <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-surface-2/40 transition-colors">
                    <div className={`w-8 h-8 rounded-lg ${step.bg} flex items-center justify-center shrink-0`}>
                      <step.icon size={14} className={step.color} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[0.75rem] font-semibold text-text">{step.label}</p>
                      <p className="text-[0.6875rem] text-text-muted">{step.detail}</p>
                    </div>
                    <Eye size={12} className="text-text-muted cursor-pointer hover:text-primary transition-colors" />
                  </div>
                  {i < arr.length - 1 && (
                    <div className="flex justify-center py-0.5">
                      <ArrowDown size={12} className="text-border-light" />
                    </div>
                  )}
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
