import { motion } from 'motion/react';
import { X, Mail, Clock, User, AtSign } from 'lucide-react';
import { EMAIL_TEMPLATE, EXCEPTION_DATA, RISK_OWNERS } from '../../data/mockData';

interface Props {
  recipientName: string | null;
  onClose: () => void;
}

export default function EmailPreviewModal({ recipientName, onClose }: Props) {
  const owner = RISK_OWNERS.find(o => o.name === recipientName) ?? RISK_OWNERS[0];
  const exception = EXCEPTION_DATA.find(e => e.assignee === recipientName) ?? EXCEPTION_DATA[0];
  const emailBody = EMAIL_TEMPLATE.body(owner.name, exception.id, exception.invoiceNo, exception.vendor, exception.amount);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="relative glass-card-strong rounded-2xl shadow-2xl w-[560px] max-h-[80vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border-light flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-evidence-50 text-evidence-700 rounded-xl">
              <Mail size={16} />
            </div>
            <div>
              <h3 className="text-[0.875rem] font-semibold text-text">Email Preview</h3>
              <p className="text-[0.75rem] text-text-muted">Notification sent to risk owner</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-paper-50 rounded-lg transition-colors cursor-pointer">
            <X size={16} className="text-text-muted" />
          </button>
        </div>

        {/* Email Chrome */}
        <div className="px-5 py-3 border-b border-border-light bg-surface-2 space-y-2 text-[0.75rem] shrink-0">
          <div className="flex items-center gap-2">
            <AtSign size={12} className="text-text-muted shrink-0" />
            <span className="text-text-muted">From:</span>
            <span className="text-text font-medium">{EMAIL_TEMPLATE.from}</span>
          </div>
          <div className="flex items-center gap-2">
            <User size={12} className="text-text-muted shrink-0" />
            <span className="text-text-muted">To:</span>
            <span className="text-text font-medium">{owner.name} &lt;{owner.email}&gt;</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail size={12} className="text-text-muted shrink-0" />
            <span className="text-text-muted">Subject:</span>
            <span className="text-text font-semibold">{EMAIL_TEMPLATE.subject}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={12} className="text-text-muted shrink-0" />
            <span className="text-text-muted">Sent:</span>
            <span className="text-text">Mar 25, 2026 at 10:32 AM</span>
          </div>
        </div>

        {/* Email Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <pre className="text-[0.8125rem] text-text leading-relaxed whitespace-pre-wrap font-sans">
            {emailBody}
          </pre>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border-light flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary text-white rounded-xl text-[0.75rem] font-semibold hover:bg-primary-hover transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
