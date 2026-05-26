import { motion } from 'motion/react';
import {
  Download, FileText, Table2, Slack, Settings2,
  CheckCircle2, XCircle, Shield,
  ArrowRightLeft, Eye
} from 'lucide-react';
import { useToast } from '../shared/Toast';

interface Props {
  workflowId: string;
  workflowType: string;
  workflowName: string;
}

/* ─── Detection Output ─── */
function DetectionOutput() {
  const rows = [
    { id: 'FLG-001', desc: 'Duplicate invoice #INV-4892 — Acme Corp', amount: '₹1,24,500', score: 97, severity: 'critical', date: 'Mar 20' },
    { id: 'FLG-002', desc: 'Suspected duplicate #INV-5011 — Globe Ltd', amount: '₹88,200', score: 89, severity: 'high', date: 'Mar 20' },
    { id: 'FLG-003', desc: 'Partial match #INV-4950 — Zenith Inc', amount: '₹2,45,000', score: 76, severity: 'medium', date: 'Mar 19' },
    { id: 'FLG-004', desc: 'Amount anomaly #INV-5102 — Apex Trade', amount: '₹67,300', score: 72, severity: 'medium', date: 'Mar 19' },
    { id: 'FLG-005', desc: 'Vendor mismatch #INV-4811 — Delta Mfg', amount: '₹3,10,000', score: 65, severity: 'low', date: 'Mar 18' },
  ];

  const sevColor: Record<string, string> = {
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#d97706',
    low: '#16a34a',
  };

  return (
    <div className="bg-white rounded-xl border border-border-light overflow-hidden">
      <div className="grid grid-cols-[4px_70px_1fr_100px_60px_70px_160px] gap-3 px-4 py-2.5 bg-surface-2 border-b border-border-light">
        <span />
        {['Flag', 'Description', 'Amount', 'Score', 'Date', 'Actions'].map(h => (
          <span key={h} className="text-[0.75rem] font-bold text-text-muted">{h}</span>
        ))}
      </div>
      {rows.map((r, i) => (
        <motion.div
          key={r.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.04 }}
          className={`grid grid-cols-[4px_70px_1fr_100px_60px_70px_160px] gap-3 px-4 py-3 border-b border-border-light last:border-0 items-center ${r.severity === 'critical' ? 'bg-risk-50/30' : 'hover:bg-surface-2/30'} transition-colors`}
        >
          <div className="w-1 h-8 rounded-full" style={{ background: sevColor[r.severity] }} />
          <span className="text-[0.75rem] font-mono text-primary font-medium">{r.id}</span>
          <span className="text-[0.75rem] text-text truncate">{r.desc}</span>
          <span className="text-[0.75rem] font-mono font-medium text-text">{r.amount}</span>
          <div className="relative w-8 h-8">
            <svg width="32" height="32" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="13" fill="none" stroke="#e5e7eb" strokeWidth="2.5" />
              <circle cx="16" cy="16" r="13" fill="none" stroke={sevColor[r.severity]} strokeWidth="2.5"
                strokeDasharray={`${(r.score / 100) * 81.68} 81.68`} strokeLinecap="round"
                transform="rotate(-90 16 16)" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[0.75rem] font-bold" style={{ color: sevColor[r.severity] }}>{r.score}</span>
          </div>
          <span className="text-[0.75rem] text-text-muted">{r.date}</span>
          <div className="flex gap-1">
            <button className="px-2 py-1 rounded-md text-[0.75rem] font-semibold bg-compliant-50 text-compliant-700 hover:bg-compliant-50/80 transition-colors cursor-pointer">Approve</button>
            <button className="px-2 py-1 rounded-md text-[0.75rem] font-semibold bg-risk-50 text-risk-700 hover:bg-risk-50/80 transition-colors cursor-pointer">Block</button>
            <button className="px-2 py-1 rounded-md text-[0.75rem] font-semibold bg-mitigated-50 text-mitigated-700 hover:bg-mitigated-50/80 transition-colors cursor-pointer">Escalate</button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ─── Monitoring Output ─── */
function MonitoringOutput() {
  const events = [
    { time: '14:32', date: 'Mar 20', title: 'Bank account changed — Vendor #V-1042 (Acme Corp)', status: 'red', detail: 'IFSC changed from HDFC0001234 to ICIC0005678 — Unauthorized', ack: false },
    { time: '11:15', date: 'Mar 20', title: 'Contact email updated — Vendor #V-892 (Globe Ltd)', status: 'amber', detail: 'Primary contact changed. Awaiting manager approval.', ack: false },
    { time: '09:45', date: 'Mar 20', title: 'Address verified — Vendor #V-1105 (Zenith Inc)', status: 'green', detail: 'GST address reconciled with MCA records. Auto-approved.', ack: true },
    { time: '17:20', date: 'Mar 19', title: 'Payment terms modified — Vendor #V-780 (Delta Mfg)', status: 'amber', detail: 'Net-30 → Net-15. Finance review required.', ack: true },
    { time: '10:05', date: 'Mar 19', title: 'New vendor onboarded — Vendor #V-1201 (Apex Trade)', status: 'green', detail: 'KYC complete. Approved by procurement head.', ack: true },
  ];

  const statusColor: Record<string, { bg: string; dot: string; label: string }> = {
    red: { bg: 'bg-risk-50', dot: 'bg-risk', label: 'Critical' },
    amber: { bg: 'bg-mitigated-50', dot: 'bg-mitigated', label: 'Warning' },
    green: { bg: 'bg-compliant-50', dot: 'bg-compliant', label: 'Normal' },
  };

  return (
    <div className="space-y-2">
      {events.map((e, i) => {
        const sc = statusColor[e.status];
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`relative flex gap-4 p-4 rounded-xl border border-border-light/50 ${sc.bg}/30 hover:shadow-sm transition-all`}
          >
            {/* Timeline connector */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className={`w-2.5 h-2.5 rounded-full ${sc.dot} ${e.status === 'red' ? 'animate-pulse' : ''}`} />
              {i < events.length - 1 && <div className="w-px flex-1 bg-border-light" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[0.75rem] font-semibold text-text">{e.title}</span>
                <span className={`text-[0.75rem] font-bold px-1.5 py-0.5 rounded-full ${sc.bg} ${e.status === 'red' ? 'text-risk-700' : e.status === 'amber' ? 'text-mitigated-700' : 'text-compliant-700'}`}>{sc.label}</span>
              </div>
              <p className="text-[0.75rem] text-text-muted leading-relaxed mb-1.5">{e.detail}</p>
              <div className="flex items-center gap-3">
                <span className="text-[0.75rem] font-mono text-text-muted">{e.time} · {e.date}</span>
                <button className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[0.75rem] font-semibold transition-colors cursor-pointer ${e.ack ? 'bg-compliant-50 text-compliant-700' : 'bg-surface-2 text-text-muted hover:bg-primary/10 hover:text-primary'}`}>
                  {e.ack ? <><CheckCircle2 size={9} /> Acknowledged</> : <><Eye size={9} /> Acknowledge</>}
                </button>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ─── Compliance Output ─── */
function ComplianceOutput() {
  const checks = [
    { rule: 'ASC 606 Step 1 — Contract Identification', ref: 'ASC 606-10-25-1', status: 'pass', score: 100 },
    { rule: 'ASC 606 Step 2 — Performance Obligations', ref: 'ASC 606-10-25-14', status: 'pass', score: 98 },
    { rule: 'ASC 606 Step 3 — Transaction Price', ref: 'ASC 606-10-32-2', status: 'pass', score: 95 },
    { rule: 'ASC 606 Step 4 — Allocation', ref: 'ASC 606-10-32-28', status: 'fail', score: 62 },
    { rule: 'ASC 606 Step 5 — Revenue Recognition Timing', ref: 'ASC 606-10-25-30', status: 'pass', score: 91 },
    { rule: 'SOD — Create & Approve Segregation', ref: 'SOX 302/404', status: 'pass', score: 100 },
    { rule: 'SOD — Payment & Reconciliation Segregation', ref: 'SOX 302/404', status: 'fail', score: 45 },
    { rule: 'Role Conflict — Vendor Maintenance + AP', ref: 'COSO IC', status: 'pass', score: 88 },
  ];

  const passCount = checks.filter(c => c.status === 'pass').length;
  const total = checks.length;
  const pct = Math.round((passCount / total) * 100);
  const circumference = 2 * Math.PI * 44;

  return (
    <div className="space-y-4">
      {/* Scorecard header */}
      <div className="flex items-center gap-6 p-5 rounded-xl border border-border-light bg-surface-2/30">
        <div className="relative shrink-0">
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="#e5e7eb" strokeWidth="6" />
            <circle cx="50" cy="50" r="44" fill="none" stroke={pct >= 80 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626'} strokeWidth="6"
              strokeDasharray={`${(pct / 100) * circumference} ${circumference}`} strokeLinecap="round"
              transform="rotate(-90 50 50)" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[1.25rem] font-bold font-mono text-text">{pct}%</span>
            <span className="text-[0.75rem] text-text-muted">Compliant</span>
          </div>
        </div>
        <div className="flex-1 grid grid-cols-3 gap-4">
          <div>
            <div className="text-[0.75rem] text-text-muted mb-0.5">Passed</div>
            <div className="text-[1.25rem] font-bold font-mono text-compliant-700">{passCount}</div>
          </div>
          <div>
            <div className="text-[0.75rem] text-text-muted mb-0.5">Failed</div>
            <div className="text-[1.25rem] font-bold font-mono text-risk-700">{total - passCount}</div>
          </div>
          <div>
            <div className="text-[0.75rem] text-text-muted mb-0.5">Total Checks</div>
            <div className="text-[1.25rem] font-bold font-mono text-text">{total}</div>
          </div>
        </div>
      </div>

      {/* Check list */}
      <div className="bg-white rounded-xl border border-border-light overflow-hidden">
        {checks.map((c, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.04 }}
            className={`flex items-center gap-3 px-4 py-3 border-b border-border-light last:border-0 ${c.status === 'fail' ? 'bg-risk-50/30' : ''} transition-colors`}
          >
            {c.status === 'pass'
              ? <CheckCircle2 size={15} className="text-compliant-700 shrink-0" />
              : <XCircle size={15} className="text-risk-700 shrink-0" />
            }
            <div className="flex-1 min-w-0">
              <div className="text-[0.75rem] font-medium text-text">{c.rule}</div>
            </div>
            <span className="text-[0.75rem] font-mono font-semibold text-text-muted bg-surface-2 px-2 py-0.5 rounded-full shrink-0">{c.ref}</span>
            <span className={`text-[0.75rem] font-bold font-mono w-10 text-right ${c.status === 'pass' ? 'text-compliant-700' : 'text-risk-700'}`}>{c.score}%</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ─── Reconciliation Output ─── */
function ReconciliationOutput() {
  const matches = [
    { po: 'PO-8842', poAmt: '₹1,25,000', grn: 'GRN-4421', grnAmt: '₹1,25,000', inv: 'INV-9012', invAmt: '₹1,25,000', status: 'matched', variance: '₹0' },
    { po: 'PO-8856', poAmt: '₹88,500', grn: 'GRN-4435', grnAmt: '₹88,500', inv: 'INV-9028', invAmt: '₹89,200', status: 'variance', variance: '₹700' },
    { po: 'PO-8871', poAmt: '₹2,34,000', grn: 'GRN-4448', grnAmt: '₹2,34,000', inv: 'INV-9041', invAmt: '₹2,34,000', status: 'matched', variance: '₹0' },
    { po: 'PO-8890', poAmt: '₹56,750', grn: 'GRN-4460', grnAmt: '₹56,750', inv: '—', invAmt: '—', status: 'unmatched', variance: 'Missing' },
    { po: 'PO-8903', poAmt: '₹4,12,000', grn: 'GRN-4472', grnAmt: '₹4,10,500', inv: 'INV-9055', invAmt: '₹4,12,000', status: 'variance', variance: '₹1,500' },
  ];

  const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
    matched: { bg: 'bg-compliant-50', text: 'text-compliant-700', label: 'Matched' },
    variance: { bg: 'bg-mitigated-50', text: 'text-mitigated-700', label: 'Variance' },
    unmatched: { bg: 'bg-risk-50', text: 'text-risk-700', label: 'Unmatched' },
  };

  return (
    <div className="space-y-3">
      {matches.map((m, i) => {
        const ss = statusStyles[m.status];
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`grid grid-cols-[1fr_auto_1fr] gap-0 rounded-xl border overflow-hidden ${m.status === 'unmatched' ? 'border-risk' : m.status === 'variance' ? 'border-mitigated' : 'border-border-light'}`}
          >
            {/* PO Side */}
            <div className="p-4 bg-white">
              <div className="text-[0.75rem] font-bold text-text-muted mb-1">Purchase Order</div>
              <div className="text-[0.8125rem] font-mono font-semibold text-primary">{m.po}</div>
              <div className="text-[0.75rem] font-mono text-text mt-0.5">{m.poAmt}</div>
            </div>

            {/* Center match indicator */}
            <div className={`w-20 flex flex-col items-center justify-center gap-1 ${ss.bg}`}>
              <ArrowRightLeft size={14} className={ss.text} />
              <span className={`text-[0.75rem] font-bold ${ss.text} uppercase`}>{ss.label}</span>
              {m.variance !== '₹0' && m.variance !== 'Missing' && (
                <span className="text-[0.75rem] font-mono font-semibold text-mitigated-700">{m.variance}</span>
              )}
              {m.variance === 'Missing' && (
                <span className="text-[0.75rem] font-mono font-semibold text-risk-700">No Invoice</span>
              )}
            </div>

            {/* Invoice Side */}
            <div className="p-4 bg-white">
              <div className="text-[0.75rem] font-bold text-text-muted mb-1">Invoice</div>
              <div className={`text-[0.8125rem] font-mono font-semibold ${m.inv === '—' ? 'text-risk-700' : 'text-primary'}`}>{m.inv}</div>
              <div className={`text-[0.75rem] font-mono mt-0.5 ${m.inv === '—' ? 'text-text-muted' : 'text-text'}`}>{m.invAmt}</div>
              {m.grn !== '—' && (
                <div className="text-[0.75rem] text-text-muted mt-0.5">GRN: {m.grn} · {m.grnAmt}</div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ─── Layout type labels ─── */
const LAYOUT_LABELS: Record<string, string> = {
  Detection: 'Risk Detection Table',
  Monitoring: 'Activity Feed',
  Compliance: 'Compliance Scorecard',
  Reconciliation: 'Three-Way Match View',
};

export default function WorkflowOutputPreview({ workflowId: _workflowId, workflowType, workflowName }: Props) {
  const { addToast } = useToast();
  const layoutLabel = LAYOUT_LABELS[workflowType] || 'Standard Output';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-[0.8125rem] font-semibold text-text">Output Preview — <span className="text-primary">{layoutLabel}</span></h3>
          <span className="text-[0.75rem] font-bold text-text-muted bg-surface-2 px-2 py-0.5 rounded-full">{workflowName}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => addToast({ message: 'Layout customization panel coming soon', type: 'info' })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-light text-[0.75rem] font-medium text-text-muted hover:border-primary/30 hover:text-primary transition-colors cursor-pointer"
          >
            <Settings2 size={11} /> Customize Layout
          </button>
          <div className="flex items-center gap-0.5 bg-surface-2 rounded-lg p-0.5">
            {[
              { label: 'PDF', icon: FileText },
              { label: 'Excel', icon: Table2 },
              { label: 'Slack', icon: Slack },
            ].map(exp => (
              <button
                key={exp.label}
                onClick={() => addToast({ message: `Exporting as ${exp.label}...`, type: 'success' })}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[0.75rem] font-medium text-text-muted hover:bg-white hover:text-primary hover:shadow-sm transition-all cursor-pointer"
              >
                <exp.icon size={10} />
                {exp.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => addToast({ message: 'Downloading full output...', type: 'success' })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-[0.75rem] font-semibold hover:bg-primary-hover transition-colors cursor-pointer"
          >
            <Download size={11} /> Export
          </button>
        </div>
      </div>

      {/* Output UI per type */}
      {workflowType === 'Detection' && <DetectionOutput />}
      {workflowType === 'Monitoring' && <MonitoringOutput />}
      {workflowType === 'Compliance' && <ComplianceOutput />}
      {workflowType === 'Reconciliation' && <ReconciliationOutput />}

      {/* Footer summary */}
      <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-surface-2/50 border border-border-light/50">
        <div className="flex items-center gap-4">
          <span className="text-[0.75rem] text-text-muted">Last generated: <span className="font-semibold text-text">Mar 20, 2026 · 2:45 PM</span></span>
          <span className="text-[0.75rem] text-text-muted">Processing time: <span className="font-semibold text-text">1.8s</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <Shield size={10} className="text-compliant-700" />
          <span className="text-[0.75rem] font-medium text-compliant-700">Audit trail recorded</span>
        </div>
      </div>
    </div>
  );
}
