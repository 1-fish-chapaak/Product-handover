import { useState } from 'react';
import { motion } from 'motion/react';
import {
  X, FileText, ChevronDown, ChevronRight, CheckCircle2,
  Clock, AlertTriangle, MessageSquare, Shield, Workflow,
  Lock, Plus, Send
} from 'lucide-react';

interface WorkingPaperRound {
  round: number;
  date: string;
  tester: string;
  status: 'complete' | 'in-progress';
  populationSize: number;
  sampleSize: number;
  attributes: {
    name: string;
    result: 'pass' | 'fail' | 'na' | 'pending';
    notes: string;
  }[];
  evidenceRefs: string[];
  conclusion: string;
  reviewerNotes: string;
  reviewerStatus: 'approved' | 'pending' | 'rejected' | '';
}

interface WorkingPaperData {
  testInstanceId: string;
  controlId: string;
  controlName: string;
  engagement: string;
  workflowName: string;
  workflowVersion: string;
  controlObjective: string;
  controlDescription: string;
  frequency: string;
  controlOwner: string;
  rounds: WorkingPaperRound[];
  finalConclusion: 'Effective' | 'Ineffective' | 'Pending';
}

const MOCK_WORKING_PAPER: WorkingPaperData = {
  testInstanceId: 'TI-001',
  controlId: 'C-001',
  controlName: 'Credit Limit Approval',
  engagement: 'ENG-2026-001',
  workflowName: 'Credit Limit Validation',
  workflowVersion: 'v2.1',
  controlObjective: 'Ensure all credit limits above $50K require dual approval before activation in the ERP system.',
  controlDescription: 'Management reviews and approves credit limit changes exceeding the materiality threshold. The control requires documented evidence of approval from both the Credit Manager and Finance Director.',
  frequency: 'Per occurrence',
  controlOwner: 'Sarah Miller',
  rounds: [
    {
      round: 1,
      date: 'Feb 15, 2026',
      tester: 'Tushar Goel',
      status: 'complete',
      populationSize: 1247,
      sampleSize: 25,
      attributes: [
        { name: 'Approval exists', result: 'pass', notes: 'All 25 samples had documented approval' },
        { name: 'Dual authorization verified', result: 'pass', notes: 'Credit Manager + Finance Director sign-off present' },
        { name: 'Approval before activation', result: 'pass', notes: 'Timestamps confirm approval preceded ERP activation' },
        { name: 'Threshold accuracy', result: 'pass', notes: 'All items exceeding $50K threshold correctly identified' },
      ],
      evidenceRefs: ['credit_approvals_q1.pdf', 'erp_activation_log.xlsx'],
      conclusion: 'All 25 samples passed all attributes. Control operating effectively for Q1 period.',
      reviewerNotes: 'Reviewed and concur with tester conclusions. Sample selection methodology validated.',
      reviewerStatus: 'approved',
    },
    {
      round: 2,
      date: 'Apr 10, 2026',
      tester: 'Tushar Goel',
      status: 'in-progress',
      populationSize: 1389,
      sampleSize: 25,
      attributes: [
        { name: 'Approval exists', result: 'pass', notes: '24/25 samples verified' },
        { name: 'Dual authorization verified', result: 'pending', notes: 'Awaiting confirmation on 3 samples' },
        { name: 'Approval before activation', result: 'pending', notes: 'In progress' },
        { name: 'Threshold accuracy', result: 'pass', notes: 'Threshold logic confirmed accurate' },
      ],
      evidenceRefs: ['credit_approvals_q2.pdf'],
      conclusion: '',
      reviewerNotes: '',
      reviewerStatus: '',
    },
  ],
  finalConclusion: 'Pending',
};

function ResultBadge({ result }: { result: string }) {
  const map: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    pass: { bg: 'bg-green-50', text: 'text-green-700', icon: <CheckCircle2 size={10} /> },
    fail: { bg: 'bg-red-50', text: 'text-red-700', icon: <AlertTriangle size={10} /> },
    pending: { bg: 'bg-amber-50', text: 'text-amber-700', icon: <Clock size={10} /> },
    na: { bg: 'bg-canvas', text: 'text-ink-500', icon: null },
  };
  const s = map[result] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 ${s.bg} ${s.text} px-2 py-0.5 rounded-full text-[0.6875rem] font-bold uppercase`}>
      {s.icon}
      {result}
    </span>
  );
}

function ReviewerBadge({ status }: { status: string }) {
  if (!status) return <span className="text-ink-300 text-[0.6875rem]">-</span>;
  const map: Record<string, { bg: string; text: string }> = {
    approved: { bg: 'bg-green-50 border-green-200', text: 'text-green-700' },
    pending: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
    rejected: { bg: 'bg-red-50 border-red-200', text: 'text-red-700' },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 ${s.bg} ${s.text} border px-2 py-0.5 rounded-full text-[0.6875rem] font-bold capitalize`}>
      {status}
    </span>
  );
}

interface Props {
  controlId?: string;
  onClose: () => void;
  onViewWorkflow?: () => void;
  onViewTrace?: () => void;
}

export default function WorkingPaperPanel({ onClose, onViewWorkflow, onViewTrace }: Props) {
  const wp = MOCK_WORKING_PAPER;
  const [expandedRounds, setExpandedRounds] = useState<number[]>([wp.rounds.length]); // latest round expanded
  const [newComment, setNewComment] = useState('');

  const toggleRound = (round: number) => {
    setExpandedRounds(prev =>
      prev.includes(round) ? prev.filter(r => r !== round) : [...prev, round]
    );
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed right-0 top-0 bottom-0 w-[560px] bg-white border-l border-border-light shadow-2xl z-50 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-light bg-surface-2/30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
            <FileText size={18} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="text-[0.875rem] font-bold text-text">Working Paper</h2>
            <p className="text-[0.6875rem] text-text-muted font-mono">{wp.testInstanceId} / {wp.controlId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onViewWorkflow && (
            <button onClick={onViewWorkflow} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border-light text-[0.6875rem] font-semibold text-text-secondary hover:bg-surface-2 transition-colors cursor-pointer">
              <Workflow size={12} />
              Workflow
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
        {/* Control Info Section */}
        <div className="px-6 py-4 border-b border-border-light">
          <h3 className="text-[0.75rem] font-bold text-text-muted uppercase mb-3">Control Information</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[0.6875rem] text-text-muted">Control</span>
              <p className="text-[0.75rem] font-semibold text-text">{wp.controlName}</p>
            </div>
            <div>
              <span className="text-[0.6875rem] text-text-muted">Engagement</span>
              <p className="text-[0.75rem] font-mono text-primary">{wp.engagement}</p>
            </div>
            <div>
              <span className="text-[0.6875rem] text-text-muted">Frequency</span>
              <p className="text-[0.75rem] text-text-secondary">{wp.frequency}</p>
            </div>
            <div>
              <span className="text-[0.6875rem] text-text-muted">Control Owner</span>
              <p className="text-[0.75rem] text-text-secondary">{wp.controlOwner}</p>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-[0.6875rem] text-text-muted">Objective</span>
            <p className="text-[0.75rem] text-text-secondary leading-relaxed mt-0.5">{wp.controlObjective}</p>
          </div>
        </div>

        {/* Workflow Info Section */}
        <div className="px-6 py-4 border-b border-border-light bg-indigo-50/30">
          <h3 className="text-[0.75rem] font-bold text-text-muted uppercase mb-3">Workflow Information</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="text-[0.6875rem] text-text-muted">Workflow</span>
              <p className="text-[0.75rem] font-semibold text-indigo-700">{wp.workflowName}</p>
            </div>
            <div>
              <span className="text-[0.6875rem] text-text-muted">Version</span>
              <p className="text-[0.75rem] font-mono text-text-secondary">{wp.workflowVersion}</p>
            </div>
            <div>
              <span className="text-[0.6875rem] text-text-muted">Attributes</span>
              <p className="text-[0.75rem] text-text-secondary">{wp.rounds[0]?.attributes.length ?? 0} test steps</p>
            </div>
          </div>
        </div>

        {/* Testing Rounds */}
        <div className="px-6 py-4">
          <h3 className="text-[0.75rem] font-bold text-text-muted uppercase mb-3">Testing Rounds</h3>

          <div className="space-y-3">
            {wp.rounds.map((round) => {
              const isExpanded = expandedRounds.includes(round.round);
              const isLocked = round.status === 'complete';
              const passCount = round.attributes.filter(a => a.result === 'pass').length;
              const totalAttrs = round.attributes.length;

              return (
                <div key={round.round} className={`rounded-xl border ${isLocked ? 'border-border-light' : 'border-primary/30 bg-primary/[0.02]'}`}>
                  {/* Round Header */}
                  <button
                    onClick={() => toggleRound(round.round)}
                    className="w-full flex items-center justify-between px-4 py-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronRight size={14} className="text-text-muted" />}
                      <div className="flex items-center gap-2">
                        <span className="text-[0.8125rem] font-bold text-text">Round {round.round}</span>
                        {isLocked && <Lock size={11} className="text-ink-400" />}
                      </div>
                      <span className="text-[0.6875rem] text-text-muted">{round.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[0.6875rem] text-text-muted">{passCount}/{totalAttrs} passed</span>
                      {isLocked ? (
                        <span className="text-[0.6875rem] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Complete</span>
                      ) : (
                        <span className="text-[0.6875rem] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">In Progress</span>
                      )}
                    </div>
                  </button>

                  {/* Round Detail */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-border-light/60">
                      {/* Round Meta */}
                      <div className="grid grid-cols-4 gap-3 py-3">
                        <div>
                          <span className="text-[0.625rem] text-text-muted uppercase">Tester</span>
                          <p className="text-[0.75rem] text-text-secondary font-medium">{round.tester}</p>
                        </div>
                        <div>
                          <span className="text-[0.625rem] text-text-muted uppercase">Population</span>
                          <p className="text-[0.75rem] text-text-secondary tabular-nums">{round.populationSize.toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-[0.625rem] text-text-muted uppercase">Sample</span>
                          <p className="text-[0.75rem] text-text-secondary tabular-nums">{round.sampleSize}</p>
                        </div>
                        <div>
                          <span className="text-[0.625rem] text-text-muted uppercase">Reviewer</span>
                          <ReviewerBadge status={round.reviewerStatus} />
                        </div>
                      </div>

                      {/* Attribute Results */}
                      <div className="mb-3">
                        <span className="text-[0.625rem] text-text-muted uppercase font-bold">Attribute Results</span>
                        <div className="mt-1.5 space-y-1">
                          {round.attributes.map((attr, i) => (
                            <div key={i} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-surface-2/40 hover:bg-surface-2/70 transition-colors">
                              <div className="flex-1 min-w-0">
                                <span className="text-[0.75rem] font-medium text-text">{attr.name}</span>
                                <p className="text-[0.6875rem] text-text-muted truncate">{attr.notes}</p>
                              </div>
                              <ResultBadge result={attr.result} />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Evidence References */}
                      <div className="mb-3">
                        <span className="text-[0.625rem] text-text-muted uppercase font-bold">Evidence References</span>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {round.evidenceRefs.map(ref => (
                            <span key={ref} className="inline-flex items-center gap-1 text-[0.6875rem] font-medium text-primary bg-primary/5 px-2 py-1 rounded-lg border border-primary/10 cursor-pointer hover:bg-primary/10 transition-colors">
                              <FileText size={10} />
                              {ref}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Round Conclusion */}
                      {round.conclusion && (
                        <div className="mb-3">
                          <span className="text-[0.625rem] text-text-muted uppercase font-bold">Conclusion</span>
                          <p className="text-[0.75rem] text-text-secondary leading-relaxed mt-1 p-2.5 rounded-lg bg-green-50/50 border border-green-100">{round.conclusion}</p>
                        </div>
                      )}

                      {/* Reviewer Notes */}
                      {round.reviewerNotes && (
                        <div>
                          <span className="text-[0.625rem] text-text-muted uppercase font-bold">Reviewer Notes</span>
                          <p className="text-[0.75rem] text-text-secondary leading-relaxed mt-1 p-2.5 rounded-lg bg-blue-50/50 border border-blue-100">
                            <MessageSquare size={10} className="inline mr-1 text-blue-400" />
                            {round.reviewerNotes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Final Conclusion */}
        <div className="px-6 py-4 border-t border-border-light bg-surface-2/20">
          <h3 className="text-[0.75rem] font-bold text-text-muted uppercase mb-2">Final Conclusion</h3>
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.8125rem] font-bold ${
            wp.finalConclusion === 'Effective' ? 'bg-green-50 text-green-700 border border-green-200' :
            wp.finalConclusion === 'Ineffective' ? 'bg-red-50 text-red-700 border border-red-200' :
            'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            {wp.finalConclusion === 'Effective' ? <CheckCircle2 size={14} /> :
             wp.finalConclusion === 'Ineffective' ? <AlertTriangle size={14} /> :
             <Clock size={14} />}
            {wp.finalConclusion}
          </div>
        </div>

        {/* Comments Section */}
        <div className="px-6 py-4 border-t border-border-light">
          <h3 className="text-[0.75rem] font-bold text-text-muted uppercase mb-3">Comments & Notes</h3>
          <div className="space-y-2 mb-3">
            <div className="p-2.5 rounded-lg bg-surface-2/40 border border-border-light/60">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[0.6875rem] font-bold text-text">Tushar Goel</span>
                <span className="text-[0.625rem] text-text-muted">Feb 16, 2026</span>
              </div>
              <p className="text-[0.75rem] text-text-secondary">Round 1 testing complete. All attributes passed. Ready for review.</p>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50/40 border border-blue-100/60">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[0.6875rem] font-bold text-blue-700">Karan Mehta</span>
                <span className="text-[0.625rem] text-text-muted">Feb 18, 2026</span>
                <span className="text-[0.625rem] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">Reviewer</span>
              </div>
              <p className="text-[0.75rem] text-text-secondary">Reviewed and approved. Sample methodology is sound. Proceed to Round 2.</p>
            </div>
          </div>

          {/* Add Comment */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add a comment..."
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              className="flex-1 px-3 py-2 text-[0.75rem] border border-border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all placeholder:text-text-muted"
            />
            <button className="flex items-center gap-1 px-3 py-2 bg-primary text-white rounded-lg text-[0.75rem] font-semibold hover:bg-primary-hover transition-colors cursor-pointer">
              <Send size={12} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
