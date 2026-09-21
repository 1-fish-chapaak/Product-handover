import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import SyncScheduleFields from '../sync/SyncScheduleFields';
import { cloneSchedule, type SyncSchedule } from '../sync/syncSchedule';
import { primaryBtnCls } from './theme';

/** "Bulk schedule runs" (or one workflow's own Schedule), shown in place of
 *  the Sync Live Data list. The same cadence editor as the Automatic-data-sync
 *  modal, mounted fresh each time so it opens on what is actually saved. Save
 *  stays disabled until the draft differs from what is stored. */
export default function LiveScheduleView({ title, description, initial, lastSyncedLabel, onBack, onSave }: {
  title: string;
  description: string;
  initial: SyncSchedule;
  lastSyncedLabel?: string;
  onBack: () => void;
  onSave: (next: SyncSchedule) => void;
}) {
  const [draft, setDraft] = useState<SyncSchedule>(() => cloneSchedule(initial));
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  return (
    <div className="flex flex-col" data-testid="live-schedule-view">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 -ml-1.5 text-ink-500 hover:text-ink-900 rounded-lg hover:bg-canvas transition-colors cursor-pointer"
          title="Back to live data"
          aria-label="Back to live data"
          data-testid="live-schedule-back"
        >
          <ArrowLeft size={15} />
        </button>
        <h3 className="text-sm font-semibold text-ink-900 truncate">{title}</h3>
      </div>
      <p className="text-xs text-ink-500 mt-1 mb-3">{description}</p>
      <SyncScheduleFields draft={draft} onPatch={p => setDraft(d => ({ ...d, ...p }))} lastSyncedLabel={lastSyncedLabel} />
      <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-canvas-border">
        <button
          type="button"
          onClick={onBack}
          className="px-4 h-9 rounded-lg border border-canvas-border bg-canvas-elevated text-sm text-ink-700 hover:bg-canvas transition-colors cursor-pointer"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => onSave(draft)}
          disabled={!dirty}
          title={dirty ? 'Save this schedule' : 'No changes to save'}
          className={primaryBtnCls}
          data-testid="live-schedule-save"
        >
          Save schedule
        </button>
      </div>
    </div>
  );
}
