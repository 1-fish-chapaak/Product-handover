// ─── Engagement Execution V2 — Placeholder ───────────────────────────────
// Temporary placeholder while old execution UI is detached and V2 is built.
// Old execution components are NOT deleted — only unreachable from main flow.

import { ArrowLeft, Shield, Calendar, User, Clock, Construction } from 'lucide-react';
import { ENGAGEMENTS } from '../../data/mockData';

interface Props {
  engagementId?: string;
  onBack: () => void;
}

export default function EngagementExecutionV2Placeholder({ engagementId, onBack }: Props) {
  // Resolve engagement metadata from mock data
  const engagement = ENGAGEMENTS.find(e => e.id === engagementId);
  const name = engagement?.name || 'Engagement';
  const status = engagement?.status || 'draft';
  const auditPeriod = engagement ? `${engagement.start} — ${engagement.end}` : '—';
  const process = engagement?.bps?.join(', ').toUpperCase() || '—';
  const framework = engagement?.type || '—';

  return (
    <div className="h-full overflow-y-auto bg-surface-2">
      <div className="px-10 py-6 max-w-[900px] mx-auto">

        {/* Back */}
        <button onClick={onBack} className="flex items-center gap-1.5 text-[0.75rem] text-text-muted hover:text-primary font-medium cursor-pointer transition-colors mb-6">
          <ArrowLeft size={14} />Back to Process Hub
        </button>

        {/* Header Card */}
        <div className="bg-white rounded-2xl border border-border-light p-8 mb-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h1 className="text-[1.375rem] font-bold text-text">{name}</h1>
              <p className="text-[0.8125rem] text-text-muted mt-1">Engagement Execution V2</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-[0.6875rem] font-semibold ${
              status === 'active' ? 'bg-emerald-50 text-emerald-700' :
              status === 'complete' ? 'bg-blue-50 text-blue-700' :
              'bg-canvas text-ink-600'
            }`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
          </div>

          <div className="grid grid-cols-4 gap-4 text-[0.75rem]">
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-ink-400 shrink-0" />
              <div>
                <span className="text-ink-400 block text-[0.625rem]">Framework</span>
                <span className="text-text font-medium">{framework}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-ink-400 shrink-0" />
              <div>
                <span className="text-ink-400 block text-[0.625rem]">Audit Period</span>
                <span className="text-text font-medium">{auditPeriod}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-ink-400 shrink-0" />
              <div>
                <span className="text-ink-400 block text-[0.625rem]">Process</span>
                <span className="text-text font-medium">{process}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <User size={14} className="text-ink-400 shrink-0" />
              <div>
                <span className="text-ink-400 block text-[0.625rem]">Owner</span>
                <span className="text-text font-medium">{engagement?.owner || '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Placeholder Message */}
        <div className="bg-white rounded-2xl border border-border-light p-10 text-center">
          <Construction size={40} className="mx-auto text-primary/40 mb-4" />
          <h2 className="text-[1.125rem] font-bold text-text mb-2">Execution Workspace — Rebuilding</h2>
          <p className="text-[0.8125rem] text-text-muted max-w-md mx-auto leading-relaxed">
            Old execution flow has been disabled for this engagement. The new execution workspace will be implemented here.
          </p>
          <div className="mt-6">
            <button onClick={onBack}
              className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer">
              Back to Process Hub
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
