import { useState, useMemo } from 'react';
import { CalendarClock, Clock, Calendar, CalendarDays, CalendarRange, CalendarCheck, CalendarFold, Repeat, Bell, Database, Minus, Plus, Zap, RefreshCw, Globe } from 'lucide-react';
import Modal from '../../shared/Modal';
import { Button } from '../../shared/Button';
import {
  type SyncSchedule, type SyncFrequency, type CustomUnit,
  DAY_INITIAL, DEFAULT_SYNC_SCHEDULE, summarizeSchedule, nextRun, fmtNextRun, cloneSchedule,
} from './syncSchedule';

const FREQS: { id: SyncFrequency; label: string; Icon: typeof Clock }[] = [
  { id: 'custom', label: 'Custom', Icon: Repeat },
  { id: 'hourly', label: 'Hourly', Icon: Clock },
  { id: 'daily', label: 'Daily', Icon: CalendarClock },
  { id: 'weekly', label: 'Weekly', Icon: CalendarDays },
  { id: 'monthly', label: 'Monthly', Icon: Calendar },
  { id: 'quarterly', label: 'Quarterly', Icon: CalendarRange },
  { id: 'semiannual', label: 'Semi-annual', Icon: CalendarCheck },
  { id: 'annual', label: 'Annually', Icon: CalendarFold },
];

// The cadences that run on a day-of-month + time (vs weekly/hourly/custom).
const MONTHLY_LIKE: SyncFrequency[] = ['monthly', 'quarterly', 'semiannual', 'annual'];
const MONTHLY_NOTE: Record<string, string> = {
  monthly: 'of each month',
  quarterly: 'each quarter · Jan, Apr, Jul, Oct',
  semiannual: 'twice a year · Jan & Jul',
  annual: 'each year · January',
};

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[24px] w-[42px] shrink-0 items-center rounded-full transition-colors cursor-pointer ${checked ? 'bg-brand-600' : 'bg-ink-300'}`}>
      <span className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[21px]' : 'translate-x-[3px]'}`} />
    </button>
  );
}

function Stepper({ value, onChange, min, max, suffix }: { value: number; onChange: (v: number) => void; min: number; max: number; suffix?: string }) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <div className="inline-flex items-center rounded-md border border-canvas-border overflow-hidden bg-canvas">
      <button type="button" aria-label="Decrease" onClick={() => set(value - 1)} disabled={value <= min} className="w-8 h-8 inline-flex items-center justify-center text-ink-500 hover:text-ink-900 hover:bg-canvas-elevated disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"><Minus size={14} /></button>
      <span className="min-w-[52px] px-1 text-center text-[0.8125rem] font-semibold text-ink-800 tabular-nums select-none">{value}{suffix ? <span className="text-ink-400 font-normal text-[0.6875rem]"> {suffix}</span> : null}</span>
      <button type="button" aria-label="Increase" onClick={() => set(value + 1)} disabled={value >= max} className="w-8 h-8 inline-flex items-center justify-center text-ink-500 hover:text-ink-900 hover:bg-canvas-elevated disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"><Plus size={14} /></button>
    </div>
  );
}

function localTz(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time'; } catch { return 'Local time'; }
}

/**
 * Scheduled data-sync configurator for a live (SQL) dashboard. Enable it and the
 * dashboard re-queries the source and refreshes on the chosen cadence; disable
 * it to return to manual refresh only. Holds a working draft — Save commits.
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
  const [now] = useState(() => new Date());
  const [tz] = useState(localTz);

  const patch = (p: Partial<SyncSchedule>) => setDraft(d => ({ ...d, ...p }));
  const toggleDay = (d: number) => patch({ days: draft.days.includes(d) ? draft.days.filter(x => x !== d) : [...draft.days, d] });

  const next = useMemo(() => nextRun(draft, now), [draft, now]);
  const summary = summarizeSchedule(draft);
  const dim = draft.enabled ? '' : 'opacity-45 pointer-events-none';
  const needsTime = draft.frequency === 'daily' || draft.frequency === 'weekly' || MONTHLY_LIKE.includes(draft.frequency);

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
        {/* Master enable */}
        <div className={`flex items-center gap-3 rounded-lg border px-4 py-3.5 transition-colors ${draft.enabled ? 'border-brand-200 bg-brand-50/40' : 'border-canvas-border bg-canvas'}`}>
          <span className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${draft.enabled ? 'bg-brand-600 text-white' : 'bg-paper-100 text-ink-400'}`}><Zap size={17} /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[0.84375rem] font-semibold text-ink-900">Scheduled sync</div>
            <div className="text-[0.71875rem] text-ink-500">{draft.enabled ? `On — ${summary.toLowerCase()}.` : 'Off — the dashboard refreshes only when you click Refresh.'}</div>
          </div>
          <Toggle checked={draft.enabled} onChange={v => patch({ enabled: v })} label="Enable scheduled sync" />
        </div>

        {/* Frequency */}
        <div className={dim}>
          <label className="block text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-500 mb-2">Frequency</label>
          <div className="grid grid-cols-4 gap-1.5">
            {FREQS.map(f => {
              const on = draft.frequency === f.id;
              return (
                <button key={f.id} type="button" onClick={() => patch({ frequency: f.id })}
                  className={`flex flex-col items-center gap-1.5 py-2.5 rounded-lg border text-[0.6875rem] font-medium transition-colors cursor-pointer ${on ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-canvas-border bg-canvas-elevated text-ink-600 hover:border-brand-200'}`}>
                  <f.Icon size={17} className={on ? 'text-brand-600' : 'text-ink-400'} /> {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail controls per frequency */}
        <div className={`rounded-lg border border-canvas-border bg-canvas p-3.5 space-y-3 ${dim}`}>
          {draft.frequency === 'custom' && (
            <div className="flex items-center gap-2.5">
              <span className="text-[0.78125rem] text-ink-700">Run every</span>
              <Stepper value={draft.everyN} onChange={v => patch({ everyN: v })} min={1} max={draft.everyUnit === 'minutes' ? 59 : 23} />
              <div className="inline-flex rounded-md border border-canvas-border overflow-hidden">
                {(['minutes', 'hours'] as CustomUnit[]).map(u => (
                  <button key={u} type="button" onClick={() => patch({ everyUnit: u, everyN: Math.min(draft.everyN, u === 'minutes' ? 59 : 23) })}
                    className={`h-8 px-3 text-[0.75rem] font-medium cursor-pointer transition-colors ${draft.everyUnit === u ? 'bg-brand-600 text-white' : 'bg-canvas-elevated text-ink-600 hover:bg-canvas'}`}>{u}</button>
                ))}
              </div>
            </div>
          )}

          {draft.frequency === 'hourly' && (
            <p className="text-[0.78125rem] text-ink-600">Syncs at the top of every hour.</p>
          )}

          {draft.frequency === 'weekly' && (
            <div>
              <div className="text-[0.75rem] font-medium text-ink-700 mb-1.5">On these days</div>
              <div className="flex gap-1.5">
                {DAY_INITIAL.map((d, i) => {
                  const on = draft.days.includes(i);
                  return (
                    <button key={i} type="button" onClick={() => toggleDay(i)} aria-pressed={on}
                      className={`w-8 h-8 rounded-full text-[0.75rem] font-semibold transition-colors cursor-pointer ${on ? 'bg-brand-600 text-white' : 'bg-canvas-elevated border border-canvas-border text-ink-500 hover:border-brand-300'}`}>{d}</button>
                  );
                })}
              </div>
            </div>
          )}

          {MONTHLY_LIKE.includes(draft.frequency) && (
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[0.78125rem] text-ink-700">On {draft.dayOfMonth === 31 ? 'the last day' : 'day'}</span>
              <Stepper value={draft.dayOfMonth} onChange={v => patch({ dayOfMonth: v })} min={1} max={31} />
              <span className="text-[0.71875rem] text-ink-400">{MONTHLY_NOTE[draft.frequency]}</span>
            </div>
          )}

          {needsTime && (
            <div className="flex items-center gap-2.5">
              <Clock size={14} className="text-ink-400" />
              <span className="text-[0.78125rem] text-ink-700">At</span>
              <input type="time" value={draft.time} onChange={e => patch({ time: e.target.value })}
                className="h-8 px-2.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.78125rem] text-ink-800 tabular-nums focus:outline-none focus:border-brand-400" />
              <span className="inline-flex items-center gap-1 text-[0.6875rem] text-ink-400"><Globe size={11} /> {tz}</span>
            </div>
          )}
        </div>

        {/* Failure notification */}
        <label className={`flex items-center gap-3 rounded-lg border border-canvas-border bg-canvas px-3.5 py-2.5 cursor-pointer ${dim}`}>
          <span className="w-8 h-8 rounded-md bg-mitigated-50 text-mitigated-700 flex items-center justify-center shrink-0"><Bell size={15} /></span>
          <span className="flex-1 text-[0.78125rem] text-ink-700">Notify me if a sync <b>fails</b></span>
          <Toggle checked={draft.notifyOnFailure} onChange={v => patch({ notifyOnFailure: v })} label="Notify on failure" />
        </label>

        {/* Next sync preview */}
        {draft.enabled && next && (
          <div className="flex items-center gap-2.5 rounded-lg bg-brand-50 border border-brand-200 px-4 py-3">
            <CalendarClock size={16} className="text-brand-600 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[0.6875rem] font-semibold uppercase tracking-wide text-brand-700/70">Next sync</div>
              <div className="text-[0.8125rem] font-semibold text-brand-800">{fmtNextRun(next, now)}</div>
            </div>
            {lastSyncedLabel && (
              <div className="text-right shrink-0">
                <div className="text-[0.6875rem] text-ink-400">Last synced</div>
                <div className="text-[0.75rem] font-medium text-ink-600 tabular-nums">{lastSyncedLabel}</div>
              </div>
            )}
          </div>
        )}

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
