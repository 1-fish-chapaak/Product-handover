import { useMemo, useState } from 'react';
import { ScrollText } from 'lucide-react';
import ListToolbar from '../../../shared/ListToolbar';
import ColumnFilter from '../../../shared/ColumnFilter';
import EmptyState from '../../../shared/EmptyState';
import { useAdminSettings, type LogAction, type TransactionLog } from '../adminStore';

// Tone per action so the log scans at a glance.
const ACTION_TONE: Record<LogAction, string> = {
  Extract: 'bg-brand-50 text-brand-700',
  Generate: 'bg-compliant-50 text-compliant-700',
  Edit: 'bg-mitigated-50 text-mitigated-700',
  Resolve: 'bg-evidence-50 text-evidence-700',
  Skip: 'bg-paper-100 text-ink-500',
  Link: 'bg-evidence-50 text-evidence-700',
  Unlink: 'bg-risk-50 text-risk-700',
  Remove: 'bg-risk-50 text-risk-700',
  Config: 'bg-brand-50 text-brand-700',
};

// ISO → "DD Mon YYYY, HH:MM".
function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

/** The "Transaction Logs" admin feature — an action-level trail of every change
 *  made in Create Report, for monitoring. Read-only. */
export default function TransactionLogs() {
  const { logs } = useAdminSettings();
  const [search, setSearch] = useState('');
  const [actionF, setActionF] = useState<string[]>([]);

  const actionOptions = useMemo(
    () => [...new Set(logs.map(l => l.action))].sort() as LogAction[],
    [logs],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter(l => {
      if (actionF.length && !actionF.includes(l.action)) return false;
      if (q && ![l.user, l.action, l.target, l.detail].join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [logs, search, actionF]);

  const hasFilter = !!search.trim() || actionF.length > 0;

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-start gap-3 mb-4 shrink-0">
        <span className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><ScrollText size={18} aria-hidden="true" /></span>
        <div>
          <h3 className="text-[0.9375rem] font-semibold text-ink-900 leading-tight">Transaction Logs</h3>
          <p className="text-[0.8125rem] text-ink-500 mt-0.5">An action-level trail of every change made in Create Report — who did what, and when.</p>
        </div>
      </div>

      <div className="shrink-0">
        <ListToolbar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search logs by user, target or detail…"
          trailing={actionOptions.length > 0 ? (
            <ColumnFilter variant="button" icon selectIndicator="checkbox" label="Action" options={actionOptions} value={actionF} onChange={setActionF} align="end" />
          ) : undefined}
        />
      </div>

      {logs.length === 0 ? (
        <EmptyState icon={ScrollText} title="No activity yet" body="Changes you make in Create Report — extractions, edits, annexure links, generated reports and admin changes — will be logged here." size="compact" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={ScrollText} title="No logs match your filters." body="Try a different search or clear the action filter." size="compact" />
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-canvas-border bg-canvas-elevated">
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-canvas">
              <tr className="text-[0.65625rem] font-semibold uppercase tracking-wide text-ink-400">
                <th className="text-left px-4 py-2.5 whitespace-nowrap">When</th>
                <th className="text-left px-4 py-2.5 whitespace-nowrap">User</th>
                <th className="text-left px-4 py-2.5 whitespace-nowrap">Action</th>
                <th className="text-left px-4 py-2.5">Target</th>
                <th className="text-left px-4 py-2.5">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-canvas-border">
              {filtered.map((l: TransactionLog) => (
                <tr key={l.id} className="hover:bg-canvas/50 transition-colors align-top">
                  <td className="px-4 py-2.5 text-[0.71875rem] tabular-nums text-ink-500 whitespace-nowrap">{fmt(l.at)}</td>
                  <td className="px-4 py-2.5 text-[0.75rem] text-ink-700 whitespace-nowrap">{l.user}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${ACTION_TONE[l.action]}`}>{l.action}</span>
                  </td>
                  <td className="px-4 py-2.5 text-[0.75rem] font-medium text-ink-800">{l.target}</td>
                  <td className="px-4 py-2.5 text-[0.75rem] text-ink-600 leading-snug">{l.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasFilter && filtered.length > 0 && (
        <p className="shrink-0 pt-2 text-[0.6875rem] text-ink-400 tabular-nums">Showing {filtered.length} of {logs.length} log{logs.length === 1 ? '' : 's'}</p>
      )}
    </div>
  );
}
