import { useState } from 'react';
import { Database, RefreshCw } from 'lucide-react';
import Modal from '../../shared/Modal';
import { Button } from '../../shared/Button';
import { type SyncSchedule, DEFAULT_SYNC_SCHEDULE, cloneSchedule } from './syncSchedule';
import SyncScheduleFields from './SyncScheduleFields';

/**
 * Scheduled data-sync configurator for a live (SQL) dashboard. Enable it and the
 * dashboard re-queries the source and refreshes on the chosen cadence; disable
 * it to return to manual refresh only. Holds a working draft — Save commits.
 * The fields themselves live in SyncScheduleFields, shared with the
 * Update-dashboard dialog's inline "Bulk schedule runs" view.
 */
export default function DashboardSyncScheduler({ open, onClose, schedule, onSave, onSyncNow, sourceName, provider, lastSyncedLabel }: {
  open: boolean;
  onClose: () => void;
  schedule: SyncSchedule;
  onSave: (next: SyncSchedule) => void;
  onSyncNow: () => void;
  sourceName?: string;
  provider?: string;
  lastSyncedLabel?: string;
}) {
  const [draft, setDraft] = useState<SyncSchedule>(() => cloneSchedule(schedule));
  const patch = (p: Partial<SyncSchedule>) => setDraft(d => ({ ...d, ...p }));

  if (!open) return null;

  return (
    <Modal
      title="Automatic data sync"
      subtitle={sourceName ? `Keep this dashboard up to date with ${sourceName}${provider ? ` · ${provider}` : ''}.` : 'Keep this dashboard up to date with its data source.'}
      width="max-w-[560px]"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" size="md" leftIcon={<RefreshCw size={15} />} onClick={onSyncNow}>Sync now</Button>
          <div className="flex-1" />
          <Button variant="outline" size="md" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="md" onClick={() => onSave(draft)}>Save schedule</Button>
        </>
      }
    >
      <div className="space-y-4">
        <SyncScheduleFields draft={draft} onPatch={patch} lastSyncedLabel={lastSyncedLabel} />

        {sourceName && (
          <p className="flex items-center gap-1.5 text-[0.6875rem] text-ink-400">
            <Database size={11} /> Reads live from <b className="text-ink-600 font-medium">{sourceName}</b>. Each sync re-queries the source and refreshes every widget.
          </p>
        )}
      </div>
    </Modal>
  );
}

export { DEFAULT_SYNC_SCHEDULE };
