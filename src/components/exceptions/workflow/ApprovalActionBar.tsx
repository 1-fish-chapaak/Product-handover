import { useState } from 'react';
import { CheckCircle2, XCircle, CornerUpLeft } from 'lucide-react';

/** Approve / Reject / Send-back action bar with a mandatory comment for the
 *  negative actions. Self-approval is prevented upstream (button disabled). */
export default function ApprovalActionBar({
  canSendBack,
  disabledReason,
  onDecide,
}: {
  canSendBack: boolean;
  disabledReason?: string;
  onDecide: (decision: 'approve' | 'reject' | 'send-back', comment: string) => void;
}) {
  const [comment, setComment] = useState('');
  const disabled = !!disabledReason;

  return (
    <div className="space-y-2.5">
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        rows={2}
        placeholder="Add a comment (required to reject or send back)…"
        disabled={disabled}
        className="w-full resize-none p-2.5 bg-canvas-elevated border border-canvas-border rounded-md text-[0.78125rem] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15 disabled:opacity-50"
      />
      {disabled ? (
        <div className="text-[0.71875rem] text-mitigated-700 bg-mitigated-50 border border-mitigated/30 rounded-md px-2.5 py-1.5">{disabledReason}</div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onDecide('approve', comment.trim())}
            className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 text-[0.78125rem] font-semibold text-white bg-compliant hover:bg-compliant-700 rounded-md cursor-pointer transition-colors"
          >
            <CheckCircle2 size={14} /> Approve
          </button>
          <button
            onClick={() => comment.trim() && onDecide('reject', comment.trim())}
            disabled={!comment.trim()}
            title={!comment.trim() ? 'A comment is required to reject' : undefined}
            className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 text-[0.78125rem] font-semibold text-white bg-risk hover:bg-risk-700 rounded-md cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XCircle size={14} /> Reject
          </button>
          {canSendBack && (
            <button
              onClick={() => comment.trim() && onDecide('send-back', comment.trim())}
              disabled={!comment.trim()}
              title={!comment.trim() ? 'A comment is required to send back' : 'Send back to the previous level'}
              className="h-9 px-3 inline-flex items-center justify-center gap-1.5 text-[0.78125rem] font-semibold text-ink-700 bg-canvas-elevated border border-canvas-border hover:border-brand-200 rounded-md cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CornerUpLeft size={14} /> Send back
            </button>
          )}
        </div>
      )}
    </div>
  );
}
