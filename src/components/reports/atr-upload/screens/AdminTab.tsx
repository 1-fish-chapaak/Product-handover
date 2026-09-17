import { useState } from 'react';
import { ListChecks, CalendarClock, Settings2, ScrollText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import LovManager from '../components/LovManager';
import TransactionLogs from '../components/TransactionLogs';
import EscalationMatrixEditor from '../components/EscalationMatrixEditor';
import { useToast } from '../../../shared/Toast';
import { useAdminSettings } from '../adminStore';

interface Feature { id: string; label: string; desc: string; icon: LucideIcon }

// Each admin capability is its own segregated feature; more will be added here.
const FEATURES: Feature[] = [
  { id: 'lov', label: 'Fields & Lists of Values', desc: 'Mandatory fields, custom fields, dropdown options', icon: ListChecks },
  { id: 'escalation', label: 'Escalation Matrix', desc: 'Default reminder & escalation cadence', icon: CalendarClock },
  { id: 'logs', label: 'Transaction Logs', desc: 'Action-level change history', icon: ScrollText },
];

/** Escalation Matrix admin feature — the full editor, opened directly, editing
 *  the org-wide default cadence applied to every new report's exceptions. */
function EscalationFeature() {
  const { escalation, setEscalation, addLog } = useAdminSettings();
  const { addToast } = useToast();
  // Bump to remount the editor → discard the working draft on Cancel.
  const [rev, setRev] = useState(0);
  return (
    <EscalationMatrixEditor
      key={rev}
      config={escalation}
      onApply={next => {
        setEscalation(next);
        addToast({ type: 'success', message: 'Default escalation matrix saved.' });
        addLog({ action: 'Config', target: 'Escalation Matrix', detail: next.enabled ? 'Updated the default escalation matrix' : 'Turned off escalation mailers' });
      }}
      onCancel={() => setRev(r => r + 1)}
    />
  );
}

/** The Admin tab — a settings surface with a feature rail on the left and the
 *  active feature on the right. Segregated feature-by-feature so new admin
 *  capabilities slot in without disturbing the others. */
export default function AdminTab() {
  const [active, setActive] = useState<string>('lov');

  return (
    <div className="h-full flex min-h-0">
      {/* Feature rail */}
      <aside className="w-[240px] shrink-0 border-r border-canvas-border px-3 py-4 overflow-y-auto">
        <div className="flex items-center gap-2 px-2 mb-3">
          <Settings2 size={15} className="text-ink-400" aria-hidden="true" />
          <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400">Admin settings</span>
        </div>
        <nav className="flex flex-col gap-0.5">
          {FEATURES.map(f => {
            const on = active === f.id;
            const Icon = f.icon;
            return (
              <button
                key={f.id}
                onClick={() => setActive(f.id)}
                aria-current={on ? 'page' : undefined}
                className={`flex items-start gap-2.5 rounded-md px-2.5 py-2 text-left cursor-pointer transition-colors ${on ? 'bg-brand-50 text-brand-800' : 'text-ink-600 hover:bg-canvas hover:text-ink-900'}`}
              >
                <Icon size={16} className={`mt-0.5 shrink-0 ${on ? 'text-brand-600' : 'text-ink-400'}`} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-[0.8125rem] font-semibold leading-tight">{f.label}</span>
                  <span className={`block text-[0.6875rem] leading-snug ${on ? 'text-brand-600/80' : 'text-ink-400'}`}>{f.desc}</span>
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Active feature — LOV scrolls in a padded frame; the escalation editor
          owns its own full-height layout, so it runs full-bleed. */}
      <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
        {active === 'lov' && <div className="h-full min-h-0"><LovManager /></div>}
        {active === 'escalation' && <div className="h-full min-h-0"><EscalationFeature /></div>}
        {active === 'logs' && <div className="h-full min-h-0 px-6 py-5"><TransactionLogs /></div>}
      </div>
    </div>
  );
}
