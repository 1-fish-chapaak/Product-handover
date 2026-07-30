import { CalendarClock, SlidersHorizontal, CalendarDays, UserCheck, Check } from 'lucide-react';
import { useAtrModalHost } from '../atrModalHost';
import { type EscalationMatrixConfig, summarizeMatrix } from '../escalationMatrix';

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full transition-colors cursor-pointer ${checked ? 'bg-brand-600' : 'bg-ink-300'}`}
    >
      <span className={`inline-block h-[16px] w-[16px] rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[19px]' : 'translate-x-[3px]'}`} />
    </button>
  );
}

/**
 * Compact Escalation Matrix summary shown inline on the Upload step, alongside
 * the report details. Enable/disable in place; "Configure" swaps in the full
 * editor over the ATR-upload modal frame (via the modal host), so there's no
 * nested modal.
 */
export default function EscalationMatrixCard({ config, onChange }: {
  config: EscalationMatrixConfig;
  onChange: (next: EscalationMatrixConfig) => void;
}) {
  const host = useAtrModalHost();

  const chips = [
    { icon: CalendarDays, label: config.weekdaysOnly ? 'Weekdays only' : 'Any day', on: config.weekdaysOnly },
    { icon: UserCheck, label: config.activeEmployeesOnly ? 'Active employees' : 'All employees', on: config.activeEmployeesOnly },
  ];

  return (
    <>
      <div className={`relative flex flex-col rounded-[14px] border bg-canvas-elevated p-4 transition-colors ${config.enabled ? 'border-brand-200' : 'border-canvas-border'}`}>
        <div className="flex items-center gap-3">
          <span className={`w-10 h-10 rounded-[11px] flex items-center justify-center shrink-0 ${config.enabled ? 'bg-brand-50 text-brand-700' : 'bg-paper-100 text-ink-400'}`}><CalendarClock size={19} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-[14px] font-semibold text-ink-900 leading-tight">Escalation Matrix</h3>
              <span className="inline-flex items-center rounded-full text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 bg-paper-100 text-ink-500">Preset</span>
            </div>
            <p className="text-[11.5px] text-ink-400 mt-0.5">Auto-chase open exceptions with reminders &amp; escalations.</p>
          </div>
          <Toggle checked={config.enabled} onChange={v => onChange({ ...config, enabled: v })} label="Enable escalation matrix" />
        </div>

        {config.enabled && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[11.5px] text-ink-600">{summarizeMatrix(config)}</span>
            <span className="text-ink-300">·</span>
            {chips.map(c => (
              <span key={c.label} className={`inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-[10.5px] font-semibold ${c.on ? 'bg-compliant-50 text-compliant-700' : 'bg-paper-100 text-ink-500'}`}>
                {c.on ? <Check size={11} aria-hidden="true" /> : <c.icon size={11} aria-hidden="true" />}{c.label}
              </span>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => host?.openEscalationEditor(config, onChange)}
          className="mt-3 inline-flex items-center justify-center gap-1.5 h-9 rounded-[8px] border border-canvas-border bg-canvas text-[12.5px] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 cursor-pointer transition-colors"
        >
          <SlidersHorizontal size={14} aria-hidden="true" /> Configure escalation matrix
        </button>
      </div>
    </>
  );
}
