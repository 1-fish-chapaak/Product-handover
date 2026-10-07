import { useState } from 'react';
import { ListChecks, Settings2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import LovManager from '../components/LovManager';

interface Feature { id: string; label: string; desc: string; icon: LucideIcon }

// Each admin capability is its own segregated feature; more will be added here.
// Two have moved out to the platform's own Administration console, where they
// serve every module rather than just this one: escalation matrices (now many,
// named by department, which a report ties to an observation or an action plan)
// and the change history, which Administration → Audit Log already keeps.
const FEATURES: Feature[] = [
  { id: 'lov', label: 'Fields & Lists of Values', desc: 'Mandatory fields, custom fields, dropdown options', icon: ListChecks },
];

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

      {/* Active feature — LOV owns its own full-height layout, so it runs
          full-bleed. */}
      <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
        {active === 'lov' && <div className="h-full min-h-0"><LovManager /></div>}
      </div>
    </div>
  );
}
