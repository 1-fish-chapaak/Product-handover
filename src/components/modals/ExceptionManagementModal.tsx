import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  X, AlertTriangle, Send, CheckCircle, FileText,
  ChevronDown, Users, Mail, Eye
} from 'lucide-react';
import { EXCEPTION_DATA, RISK_OWNERS } from '../../data/mockData';
import { useToast } from '../shared/Toast';

interface Props {
  onClose: () => void;
  onGenerateReport: () => void;
  onViewEmail: (recipientName: string) => void;
}

type ExceptionStatus = 'unassigned' | 'assigned' | 'notified' | 'in-progress' | 'resolved';

const STATUS_COLORS: Record<ExceptionStatus, string> = {
  unassigned: 'bg-paper-50 text-ink-500',
  assigned: 'bg-evidence-50 text-evidence-700',
  notified: 'bg-high-50 text-high-700',
  'in-progress': 'bg-mitigated-50 text-mitigated-700',
  resolved: 'bg-compliant-50 text-compliant-700',
};

const SCORE_COLOR = (score: number) =>
  score >= 90 ? 'bg-risk-50 text-risk-700' : score >= 80 ? 'bg-high-50 text-high-700' : 'bg-mitigated-50 text-mitigated-700';

export default function ExceptionManagementModal({ onClose, onGenerateReport, onViewEmail }: Props) {
  const { addToast } = useToast();
  const [exceptions, setExceptions] = useState(EXCEPTION_DATA.map(e => ({ ...e, status: e.status as string, assignee: e.assignee as string | null, riskOwner: e.riskOwner as string | null })));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [justAssigned, setJustAssigned] = useState<string | null>(null);

  // Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === exceptions.length) setSelected(new Set());
    else setSelected(new Set(exceptions.map(e => e.id)));
  };

  const assignException = (exceptionId: string, owner: typeof RISK_OWNERS[0]) => {
    setExceptions(prev => prev.map(e =>
      e.id === exceptionId
        ? { ...e, assignee: owner.name, riskOwner: owner.id, status: 'assigned' as const }
        : e
    ));
    setOpenDropdown(null);
    setJustAssigned(exceptionId);
    setTimeout(() => setJustAssigned(null), 1000);
  };

  const sendNotification = (exception: typeof exceptions[0]) => {
    setExceptions(prev => prev.map(e =>
      e.id === exception.id ? { ...e, status: 'notified' as const, notificationSent: true } : e
    ));
    addToast({
      type: 'success',
      message: `Email sent to ${exception.assignee}`,
      action: { label: 'View Email', onClick: () => onViewEmail(exception.assignee!) },
    });
  };

  const bulkAssign = (owner: typeof RISK_OWNERS[0]) => {
    setExceptions(prev => prev.map(e =>
      selected.has(e.id) && e.status === 'unassigned'
        ? { ...e, assignee: owner.name, riskOwner: owner.id, status: 'assigned' as const }
        : e
    ));
    setSelected(new Set());
    addToast({ type: 'success', message: `Assigned ${selected.size} exceptions to ${owner.name}` });
  };

  const stats = {
    assigned: exceptions.filter(e => e.status === 'assigned').length,
    notified: exceptions.filter(e => e.status === 'notified').length,
    resolved: exceptions.filter(e => e.status === 'resolved').length,
    unassigned: exceptions.filter(e => e.status === 'unassigned').length,
    inProgress: exceptions.filter(e => e.status === 'in-progress').length,
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        role="dialog"
        aria-modal="true"
        aria-label="Exception Management"
        className="relative bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: '80vw', maxWidth: 1100, height: '80vh', maxHeight: 700 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-10 py-4 border-b border-border-light flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-high-50 text-high-700 rounded-xl">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h2 className="text-[1rem] font-semibold text-text">Exception Management</h2>
                <p className="text-[0.75rem] text-text-muted">Duplicate Invoice Detection · Run #12 · Mar 20, 2026 · {exceptions.length} exceptions</p>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-paper-50 rounded-lg transition-colors cursor-pointer">
            <X size={18} className="text-text-muted" />
          </button>
        </div>

        {/* Bulk Actions */}
        <div className="px-10 py-3 border-b border-border-light flex items-center gap-3 bg-surface-2 shrink-0">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.size === exceptions.length}
              onChange={selectAll}
              className="w-4 h-4 rounded border-ink-300 text-primary accent-primary"
            />
            <span className="text-[0.75rem] font-medium text-text-secondary">Select All</span>
          </label>
          {selected.size > 0 && (
            <>
              <span className="text-[0.75rem] text-text-muted">({selected.size} selected)</span>
              <div className="relative">
                <button
                  onClick={() => setOpenDropdown(openDropdown === 'bulk' ? null : 'bulk')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-border rounded-lg text-[0.75rem] font-medium text-text-secondary hover:border-primary/30 transition-colors cursor-pointer"
                >
                  <Users size={13} />
                  Assign Selected
                  <ChevronDown size={11} />
                </button>
                {openDropdown === 'bulk' && (
                  <div className="absolute top-full mt-1 left-0 bg-white rounded-xl border border-border-light shadow-lg z-50 w-52 p-1.5">
                    {RISK_OWNERS.map(owner => (
                      <button
                        key={owner.id}
                        onClick={() => { bulkAssign(owner); setOpenDropdown(null); }}
                        className="w-full text-left px-3 py-2 rounded-lg text-[0.75rem] hover:bg-primary-xlight transition-colors cursor-pointer"
                      >
                        <div className="font-medium text-text">{owner.name}</div>
                        <div className="text-[0.75rem] text-text-muted">{owner.role}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  exceptions.filter(e => selected.has(e.id) && e.assignee && !e.notificationSent).forEach(sendNotification);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-[0.75rem] font-medium hover:bg-primary-hover transition-colors cursor-pointer"
              >
                <Send size={12} />
                Send Notifications
              </button>
            </>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-[0.75rem]">
            <thead className="sticky top-0 bg-surface-2 z-10">
              <tr>
                <th className="text-left px-4 py-2.5 w-10"></th>
                <th className="text-left px-3 py-2.5 font-semibold text-text-secondary">Exception ID</th>
                <th className="text-left px-3 py-2.5 font-semibold text-text-secondary">Invoice No.</th>
                <th className="text-left px-3 py-2.5 font-semibold text-text-secondary">Vendor</th>
                <th className="text-right px-3 py-2.5 font-semibold text-text-secondary">Amount</th>
                <th className="text-center px-3 py-2.5 font-semibold text-text-secondary">Match</th>
                <th className="text-left px-3 py-2.5 font-semibold text-text-secondary">Original</th>
                <th className="text-center px-3 py-2.5 font-semibold text-text-secondary">Status</th>
                <th className="text-left px-3 py-2.5 font-semibold text-text-secondary">Assigned To</th>
                <th className="text-center px-3 py-2.5 font-semibold text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {exceptions.map((exc, i) => (
                <motion.tr
                  key={exc.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className={`border-t border-border-light hover:bg-primary-xlight/30 transition-colors ${
                    justAssigned === exc.id ? 'bg-compliant-50' : i % 2 === 0 ? 'bg-white' : 'bg-surface-2/30'
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(exc.id)}
                      onChange={() => toggleSelect(exc.id)}
                      className="w-3.5 h-3.5 rounded border-ink-300 accent-primary cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-3 font-mono text-text-muted">{exc.id}</td>
                  <td className="px-3 py-3 font-medium text-text">{exc.invoiceNo}</td>
                  <td className="px-3 py-3 text-text">{exc.vendor}</td>
                  <td className="px-3 py-3 text-right font-mono font-medium text-text">${exc.amount.toLocaleString()}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[0.75rem] font-bold ${SCORE_COLOR(exc.matchScore)}`}>
                      {exc.matchScore}%
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-text-muted text-[0.75rem]">{exc.originalInvoice}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[0.75rem] font-bold capitalize ${STATUS_COLORS[exc.status as ExceptionStatus]}`}>
                      {exc.status}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {exc.assignee ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[0.75rem] font-bold flex items-center justify-center">
                          {exc.assignee.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="text-[0.75rem] text-text">{exc.assignee}</span>
                        {justAssigned === exc.id && <CheckCircle size={12} className="text-compliant-700" />}
                      </div>
                    ) : (
                      <div className="relative">
                        <button
                          onClick={() => setOpenDropdown(openDropdown === exc.id ? null : exc.id)}
                          className="flex items-center gap-1 px-2 py-1 border border-dashed border-border rounded-md text-[0.75rem] text-text-muted hover:border-primary/30 hover:text-primary transition-colors cursor-pointer"
                        >
                          <Users size={11} />
                          Assign
                          <ChevronDown size={9} />
                        </button>
                        {openDropdown === exc.id && (
                          <div className="absolute top-full mt-1 left-0 bg-white rounded-xl border border-border-light shadow-lg z-50 w-48 p-1.5">
                            {RISK_OWNERS.map(owner => (
                              <button
                                key={owner.id}
                                onClick={() => assignException(exc.id, owner)}
                                className="w-full text-left px-3 py-2 rounded-lg text-[0.75rem] hover:bg-primary-xlight transition-colors cursor-pointer"
                              >
                                <div className="font-medium text-text">{owner.name}</div>
                                <div className="text-[0.75rem] text-text-muted">{owner.role}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {exc.assignee && !exc.notificationSent && (
                        <button
                          onClick={() => sendNotification(exc)}
                          className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                          title="Send notification"
                        >
                          <Mail size={13} />
                        </button>
                      )}
                      {exc.notificationSent && (
                        <button
                          onClick={() => onViewEmail(exc.assignee!)}
                          className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                          title="View sent email"
                        >
                          <Eye size={13} />
                        </button>
                      )}
                      {exc.actionTaken && (
                        <span className="text-[0.75rem] text-text-muted italic max-w-[100px] truncate" title={exc.actionTaken}>
                          {exc.actionTaken}
                        </span>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-10 py-4 border-t border-border-light flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-4 text-[0.75rem] text-text-muted">
            <span><strong className="text-text">{stats.assigned}</strong> assigned</span>
            <span><strong className="text-text">{stats.notified}</strong> notified</span>
            <span><strong className="text-text">{stats.inProgress}</strong> in progress</span>
            <span><strong className="text-compliant-700">{stats.resolved}</strong> resolved</span>
            <span><strong className="text-risk-700">{stats.unassigned}</strong> unassigned</span>
          </div>
          <button
            onClick={onGenerateReport}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-primary-medium text-white rounded-xl text-[0.8125rem] font-semibold hover:from-primary-hover hover:to-primary transition-all cursor-pointer shadow-sm"
          >
            <FileText size={14} />
            Generate Action Report
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
